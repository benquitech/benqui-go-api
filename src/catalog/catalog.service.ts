import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginated } from '../common/dto/pagination-query.dto';
import { ROLE_DEMO } from '../common/constants';
import { CategoryClassifier } from './logic/classifier';
import { ALWAYS_EXCLUDE } from './logic/defaults';
import { formatPresentation } from './logic/quantity';
import { PROVINCES } from './logic/provinces';
import { brandKey, isValidBarcode, normalizeText, prettyName, searchText } from './logic/text';
import { demoPerCategory, rebuildDemoSelection } from './demo-rebuild';
import {
  BrandsQueryDto,
  CreateCategoryDto,
  CreateManualProductDto,
  ProductsQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

const productInclude = {
  brand: { select: { id: true, name: true, isFeatured: true } },
  category: { select: { id: true, slug: true, name: true, color: true, icon: true } },
} satisfies Prisma.CatalogProductInclude;

type ProductRow = Prisma.CatalogProductGetPayload<{ include: typeof productInclude }>;

const money = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed(2));

/** Historial que devuelve el detalle de un producto. */
const HISTORY_LIMIT = 30;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  private isDemo(user: AuthUser) {
    return user.role === ROLE_DEMO;
  }

  /** La provincia la manda el front (?province=AR-A). Sin provincia se devuelve el precio nacional. */
  private province(requested?: string): string | null {
    return requested && requested in PROVINCES ? requested : null;
  }

  /** Filtro base: lo que puede ver cualquiera (y el demo, solo su seleccion). */
  private visibleWhere(user: AuthUser, includeHidden = false): Prisma.CatalogProductWhereInput {
    const demo = this.isDemo(user);
    return {
      ...(demo || !includeHidden ? { isHidden: false } : {}),
      ...(demo ? { inDemo: true } : {}),
      OR: [{ categoryId: null }, { category: { isActive: true, isDeleted: false } }],
    };
  }

  // ── Productos ──────────────────────────────────────────────────────────────

  private toDto(p: ProductRow, user: AuthUser, province: string | null, detail = false) {
    const provincePrices = (p.provincePrices ?? {}) as Record<string, string>;
    const local = province ? provincePrices[province] : undefined;
    const base = {
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      brand: p.brand ? { id: p.brand.id, name: p.brand.name } : null,
      categoryId: p.categoryId,
      category: p.category,
      presentation: formatPresentation(p.presentationQty ? Number(p.presentationQty) : null, p.presentationUnit),
      presentationQty: p.presentationQty ? p.presentationQty.toFixed(3) : null,
      presentationUnit: p.presentationUnit,
      /** El catalogo es de productos envasados: siempre se venden por unidad. */
      saleUnit: 'UNIT' as const,
      /** Precio sugerido: el de la provincia pedida si hay datos, si no el nacional. */
      price: local ?? money(p.referencePrice),
      priceProvince: local ? province : null,
      referencePrice: money(p.referencePrice),
      minPrice: money(p.minPrice),
      maxPrice: money(p.maxPrice),
      storeCount: p.storeCount,
      priceUpdatedAt: p.priceUpdatedAt,
      source: p.source,
    };
    const admin = this.isDemo(user)
      ? {}
      : {
          isPinned: p.isPinned,
          isHidden: p.isHidden,
          inDemo: p.inDemo,
          demoRank: p.demoRank,
          categoryLocked: p.categoryLocked,
          brandFeatured: p.brand?.isFeatured ?? false,
          lastSeenAt: p.lastSeenAt,
        };
    if (!detail) return { ...base, ...admin };
    return {
      ...base,
      ...admin,
      provincePrices: Object.entries(provincePrices)
        .filter(([code]) => code in PROVINCES)
        .map(([code, price]) => ({ province: code, name: PROVINCES[code], price }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    };
  }

  async listProducts(q: ProductsQueryDto, user: AuthUser) {
    const demo = this.isDemo(user);
    const and: Prisma.CatalogProductWhereInput[] = [this.visibleWhere(user, q.includeHidden)];
    if (q.categoryId) and.push({ categoryId: q.categoryId });
    if (q.category) and.push({ category: { slug: q.category.replace(/^cat-/, '') } });
    if (q.brandId) and.push({ brandId: q.brandId });
    if (q.demoOnly && !demo) and.push({ inDemo: true });
    const words = normalizeText(q.search ?? '').split(' ').filter(Boolean).slice(0, 8);
    for (const w of words) and.push({ searchText: { contains: w } });
    const where: Prisma.CatalogProductWhereInput = { AND: and };

    const orderBy: Prisma.CatalogProductOrderByWithRelationInput[] = demo
      ? [{ category: { order: 'asc' } }, { demoRank: 'asc' }]
      : [{ storeCount: 'desc' }, { name: 'asc' }];

    const [rows, total] = await this.db.$transaction([
      this.db.catalogProduct.findMany({ where, include: productInclude, orderBy, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.db.catalogProduct.count({ where }),
    ]);
    const province = this.province(q.province);
    return paginated(
      rows.map((r) => this.toDto(r, user, province)),
      total,
      q,
    );
  }

  async findByBarcode(barcode: string, user: AuthUser, provinceCode?: string) {
    let code = barcode.trim();
    if (code.length === 14 && code.startsWith('0')) code = code.slice(1);
    const row = await this.db.catalogProduct.findFirst({
      where: { AND: [this.visibleWhere(user), { barcode: code }] },
      include: productInclude,
    });
    if (!row) throw new NotFoundException('Ese código no está en el catálogo de referencia');
    return this.toDto(row, user, this.province(provinceCode), true);
  }

  async findProduct(id: string, user: AuthUser, provinceCode?: string) {
    const row = await this.db.catalogProduct.findFirst({
      where: { AND: [this.visibleWhere(user, true), { id }] },
      include: { ...productInclude, history: { orderBy: { createdAt: 'desc' }, take: HISTORY_LIMIT } },
    });
    if (!row || (this.isDemo(user) && row.isHidden)) throw new NotFoundException('Producto no encontrado');
    return {
      ...this.toDto(row, user, this.province(provinceCode), true),
      history: row.history.map((h) => ({ date: h.createdAt, previousPrice: money(h.previousPrice), price: money(h.price) })),
    };
  }

  async createManualProduct(dto: CreateManualProductDto, actorId: string) {
    if (!isValidBarcode(dto.barcode)) throw new BadRequestException('El dígito verificador del código de barras no es válido');
    if (await this.db.catalogProduct.findUnique({ where: { barcode: dto.barcode } })) {
      throw new ConflictException(`El código ${dto.barcode} ya está en el catálogo`);
    }
    await this.assertCategory(dto.categoryId);
    const brand = dto.brandName?.trim() ? await this.upsertBrand(dto.brandName, actorId) : null;
    const name = dto.name.trim();
    const now = new Date();
    const created = await this.db.catalogProduct.create({
      data: {
        barcode: dto.barcode,
        source: 'MANUAL',
        name,
        searchText: searchText(name, brand?.name, dto.barcode),
        brandId: brand?.id ?? null,
        categoryId: dto.categoryId,
        categoryLocked: true,
        presentationQty: dto.presentationQty ?? null,
        presentationUnit: dto.presentationQty ? (dto.presentationUnit ?? 'unit') : null,
        referencePrice: dto.referencePrice,
        minPrice: dto.referencePrice,
        maxPrice: dto.referencePrice,
        priceUpdatedAt: now,
        lastSeenAt: now,
        isPinned: dto.isPinned ?? false,
        createdBy: actorId,
      },
    });
    return created.id;
  }

  async updateProduct(id: string, dto: UpdateProductDto, actorId: string) {
    const current = await this.db.catalogProduct.findUnique({ where: { id }, include: { brand: true } });
    if (!current) throw new NotFoundException('Producto no encontrado');
    if ((dto.name !== undefined || dto.referencePrice !== undefined) && current.source !== 'MANUAL') {
      throw new BadRequestException('El nombre y el precio de los productos de SEPA los actualiza la sincronización');
    }
    const data: Prisma.CatalogProductUncheckedUpdateInput = { updatedBy: actorId };
    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) {
        if (current.source === 'MANUAL') throw new BadRequestException('Un producto manual necesita un rubro');
        // Vuelve a la clasificacion automatica con las palabras clave actuales.
        const classifier = await this.classifier();
        data.categoryId = classifier.classify(current.name);
        data.categoryLocked = false;
      } else {
        await this.assertCategory(dto.categoryId);
        data.categoryId = dto.categoryId;
        data.categoryLocked = true;
      }
    }
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.isHidden !== undefined) data.isHidden = dto.isHidden;
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      data.searchText = searchText(dto.name.trim(), current.brand?.name, current.barcode);
    }
    if (dto.referencePrice !== undefined && Number(current.referencePrice) !== dto.referencePrice) {
      data.referencePrice = dto.referencePrice;
      data.minPrice = dto.referencePrice;
      data.maxPrice = dto.referencePrice;
      data.priceUpdatedAt = new Date();
      await this.db.catalogPriceHistory.create({
        data: { productId: id, previousPrice: current.referencePrice, price: dto.referencePrice },
      });
    }
    await this.db.catalogProduct.update({ where: { id }, data });
    // Fijar / ocultar / cambiar de rubro cambia la seleccion del demo.
    if (dto.isPinned !== undefined || dto.isHidden !== undefined || dto.categoryId !== undefined) {
      await rebuildDemoSelection(this.db);
    }
  }

  async deleteManualProduct(id: string) {
    const current = await this.db.catalogProduct.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Producto no encontrado');
    if (current.source !== 'MANUAL') {
      throw new BadRequestException('Los productos de SEPA no se borran: ocultalos con isHidden');
    }
    await this.db.catalogProduct.delete({ where: { id } });
    if (current.inDemo) await rebuildDemoSelection(this.db);
  }

  // ── Rubros ─────────────────────────────────────────────────────────────────

  async listCategories(user: AuthUser) {
    const demo = this.isDemo(user);
    const categories = await this.db.catalogCategory.findMany({
      where: { isDeleted: false, ...(demo ? { isActive: true } : {}) },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    const counts = await this.db.catalogProduct.groupBy({
      by: ['categoryId'],
      where: { isHidden: false, ...(demo ? { inDemo: true } : {}) },
      _count: { _all: true },
    });
    const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      /** Id equivalente en benqui-go-demo ("cat-bebidas"). */
      demoId: `cat-${c.slug}`,
      name: c.name,
      color: c.color,
      icon: c.icon,
      order: c.order,
      productCount: countBy.get(c.id) ?? 0,
      ...(demo ? {} : { isActive: c.isActive, keywords: c.keywords, excludeKeywords: c.excludeKeywords }),
    }));
  }

  async createCategory(dto: CreateCategoryDto, actorId: string) {
    const existing = await this.db.catalogCategory.findUnique({ where: { slug: dto.slug } });
    if (existing && !existing.isDeleted) throw new ConflictException(`Ya existe el rubro "${dto.slug}"`);
    const data = {
      name: dto.name.trim(),
      color: dto.color,
      icon: dto.icon ?? null,
      order: dto.order ?? null,
      keywords: cleanKeywords(dto.keywords),
      excludeKeywords: cleanKeywords(dto.excludeKeywords),
      isActive: dto.isActive ?? true,
    };
    if (existing) {
      return this.db.catalogCategory.update({
        where: { id: existing.id },
        data: { ...data, isDeleted: false, deletedAt: null, deletedBy: null, updatedBy: actorId },
      });
    }
    return this.db.catalogCategory.create({ data: { ...data, slug: dto.slug, createdBy: actorId } });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, actorId: string) {
    const current = await this.db.catalogCategory.findFirst({ where: { id, isDeleted: false } });
    if (!current) throw new NotFoundException('Rubro no encontrado');
    const updated = await this.db.catalogCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.keywords !== undefined ? { keywords: cleanKeywords(dto.keywords) } : {}),
        ...(dto.excludeKeywords !== undefined ? { excludeKeywords: cleanKeywords(dto.excludeKeywords) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedBy: actorId,
      },
    });
    if (dto.isActive !== undefined && dto.isActive !== current.isActive) await rebuildDemoSelection(this.db);
    return updated;
  }

  async deleteCategory(id: string, actorId: string) {
    const current = await this.db.catalogCategory.findFirst({ where: { id, isDeleted: false } });
    if (!current) throw new NotFoundException('Rubro no encontrado');
    await this.db.$transaction([
      this.db.catalogCategory.update({
        where: { id },
        data: { isDeleted: true, isActive: false, deletedAt: new Date(), deletedBy: actorId },
      }),
      // Sus productos quedan sin rubro (la proxima sincronizacion los vuelve a clasificar).
      this.db.catalogProduct.updateMany({ where: { categoryId: id }, data: { categoryId: null, categoryLocked: false, inDemo: false, demoRank: null } }),
    ]);
  }

  private async assertCategory(id: string) {
    const c = await this.db.catalogCategory.findFirst({ where: { id, isDeleted: false } });
    if (!c) throw new BadRequestException('El rubro no existe');
  }

  private async classifier() {
    const categories = await this.db.catalogCategory.findMany({ where: { isActive: true, isDeleted: false }, orderBy: { order: 'asc' } });
    return new CategoryClassifier(categories, ALWAYS_EXCLUDE);
  }

  /**
   * Vuelve a clasificar los productos de SEPA con las palabras clave actuales (sin esperar a la
   * proxima sincronizacion). Los productos con rubro fijado a mano no se tocan.
   */
  async reclassify() {
    const classifier = await this.classifier();
    const products = await this.db.catalogProduct.findMany({
      where: { categoryLocked: false, source: 'SEPA' },
      select: { id: true, name: true, categoryId: true },
    });
    const moves = new Map<string | null, string[]>();
    for (const p of products) {
      const next = classifier.classify(p.name);
      if (next === p.categoryId) continue;
      const list = moves.get(next) ?? [];
      list.push(p.id);
      moves.set(next, list);
    }
    let changed = 0;
    for (const [categoryId, ids] of moves) {
      for (let i = 0; i < ids.length; i += 5000) {
        const r = await this.db.catalogProduct.updateMany({ where: { id: { in: ids.slice(i, i + 5000) } }, data: { categoryId } });
        changed += r.count;
      }
    }
    const demo = await rebuildDemoSelection(this.db);
    return { reviewed: products.length, changed, demoSelected: demo.selected };
  }

  // ── Marcas ─────────────────────────────────────────────────────────────────

  async listBrands(q: BrandsQueryDto) {
    const search = brandKey(q.search ?? '');
    const where: Prisma.CatalogBrandWhereInput = {
      ...(search ? { key: { contains: search } } : {}),
      ...(q.featured !== undefined ? { isFeatured: q.featured } : {}),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.catalogBrand.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { products: true } } },
      }),
      this.db.catalogBrand.count({ where }),
    ]);
    return paginated(
      rows.map((b) => ({ id: b.id, name: b.name, isFeatured: b.isFeatured, productCount: b._count.products })),
      total,
      q,
    );
  }

  async updateBrand(id: string, isFeatured: boolean, actorId: string) {
    const brand = await this.db.catalogBrand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    const updated = await this.db.catalogBrand.update({ where: { id }, data: { isFeatured, updatedBy: actorId } });
    if (brand.isFeatured !== isFeatured) await rebuildDemoSelection(this.db);
    return { id: updated.id, name: updated.name, isFeatured: updated.isFeatured };
  }

  private async upsertBrand(name: string, actorId: string) {
    const key = brandKey(name);
    const pretty = prettyName(name.trim()).slice(0, 120);
    return this.db.catalogBrand.upsert({
      where: { key },
      update: {},
      create: { key, name: pretty, createdBy: actorId },
    });
  }

  // ── Demo y sincronizacion ──────────────────────────────────────────────────

  rebuildDemo() {
    return rebuildDemoSelection(this.db);
  }

  async demoSummary() {
    const categories = await this.listCategories({ userId: '', userName: '', role: ROLE_DEMO });
    return { productsPerCategory: demoPerCategory(), categories: categories.map((c) => ({ slug: c.slug, name: c.name, productCount: c.productCount })) };
  }

  async listSyncRuns(limit: number) {
    return this.db.catalogSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: Math.min(limit, 100) });
  }

  provinces() {
    return Object.entries(PROVINCES)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}

function cleanKeywords(list?: string[]): string[] {
  return [...new Set((list ?? []).map((k) => normalizeText(k)).filter(Boolean))];
}
