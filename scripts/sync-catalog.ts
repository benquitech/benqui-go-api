/**
 * Sincroniza el catalogo de precios de referencia con SEPA / Precios Claros.
 *
 *   npm run sync:catalog                    # ZIP de hoy (dia de la semana en Argentina)
 *   npm run sync:catalog -- lunes           # ZIP de un dia en particular
 *   npm run sync:catalog -- --dry-run       # procesa y muestra el resumen, sin escribir en la base
 *   npm run sync:catalog -- --offline       # como --dry-run pero sin base (usa los rubros y marcas por defecto)
 *   SEPA_ZIP_PATH=/ruta/sepa.zip npm run sync:catalog   # reusa un ZIP ya descargado
 *
 * Corre una vez por dia como tarea programada de Windows en una PC en Argentina
 * (scripts/register-sync-task.ps1). No corre en Vercel (el ZIP pesa ~330 MB y trae ~15 millones de
 * filas) ni en GitHub Actions (el sitio de SEPA les responde 403). A diferencia de chef-cost-api no envia
 * notificaciones: solo actualiza la base (productos, precios, historial y seleccion del demo).
 *
 * Que entra al catalogo: productos con codigo de barras real (EAN valido) cuya descripcion cae en
 * algun rubro (palabras clave de catalog_categories) y que informan al menos SYNC_MIN_STORES sucursales.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { CategoryClassifier } from '../src/catalog/logic/classifier';
import { ALWAYS_EXCLUDE, DEFAULT_CATEGORIES, FEATURED_BRANDS } from '../src/catalog/logic/defaults';
import { featuredBrandMatcher } from '../src/catalog/logic/brands';
import { priceChanged, summarize } from '../src/catalog/logic/prices';
import { detectPresentation } from '../src/catalog/logic/quantity';
import { brandKey, isValidBarcode, normalizeText, prettyName, searchText } from '../src/catalog/logic/text';
import { rebuildDemoSelection } from '../src/catalog/demo-rebuild';
import { extractCommerceZips, forEachSepaRow, getSepaZip, isDayName, todayNameArgentina } from './sepa/sepa-source';

const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const DRY_RUN = OFFLINE || args.includes('--dry-run');
const dayName = args.find((a) => !a.startsWith('--')) ?? todayNameArgentina();
const MIN_STORES = Math.max(1, Number(process.env.SYNC_MIN_STORES) || 3);
/** Distintas descripciones/marcas que se cuentan por producto para elegir la mas frecuente. */
const MAX_VARIANTS = 6;

interface Collected {
  categoryId: string;
  descriptions: Map<string, number>;
  /** Marca informada -> comercios que la usan (cada cadena vota una vez). */
  brands: Map<string, Set<string>>;
  /** Columnas de presentacion de la primera fila (para detectar 500 ml / 118 g). */
  cols: { referenceQty: string; referenceUnit: string; presentationQty: string; presentationUnit: string };
  pricesByProvince: Map<string, number[]>;
}

interface BrandRef {
  id: string;
  isFeatured: boolean;
}

function bump(map: Map<string, number>, key: string) {
  if (!key) return;
  const n = map.get(key);
  if (n !== undefined) map.set(key, n + 1);
  else if (map.size < MAX_VARIANTS) map.set(key, 1);
}

/** Saca el codigo de envase que agregan algunas cadenas al final: "... 354cc LAT-354-ml." / "PCK-1-un.". */
function cleanDescription(desc: string): string {
  return desc.replace(/\s+[A-Z/]{1,4}-[\d.,]+-[a-z]{1,3}\.?$/i, '').replace(/\s+/g, ' ').trim();
}

/**
 * Variante mas completa: una cadena grande recorta descripciones y marcas a 20 caracteres
 * ("Galle C/chips Choco", "Gille"), asi que gana la mas larga y, a igual largo, la mas frecuente.
 */
function bestVariant(map: Map<string, number>, clean: (s: string) => string = (s) => s): string {
  let best = '';
  let bestCount = -1;
  for (const [raw, n] of map) {
    const k = clean(raw);
    if (k.length > best.length || (k.length === best.length && n > bestCount)) [best, bestCount] = [k, n];
  }
  return best;
}

function addBrandVote(map: Map<string, Set<string>>, brand: string, commerce: string) {
  if (!brand) return;
  const set = map.get(brand);
  if (set) set.add(commerce);
  else if (map.size < MAX_VARIANTS) map.set(brand, new Set([commerce]));
}

const COMPANY_RE = /\b(s\.?\s?a\.?(\s?i\.?\s?c\.?)?|s\.?\s?r\.?\s?l\.?|srl|saic|s\.?\s?a\.?\s?u\.?|ltda|argentina)\s*\.?$/i;
const NO_BRAND_RE = /^(s\/?\s?d|s\/?\s?m|sin marca|generico|varios|n\/?a)$/i;

/**
 * Marca a mostrar. Gana la que: aparece en la descripcion, no es una razon social ("Danone Argentina S.a.")
 * y la informan mas cadenas (una cadena recorta marcas: "Gille" por "Gillette").
 */
function bestBrand(map: Map<string, Set<string>>, description: string): string {
  const descKey = ` ${brandKey(description)} `;
  let best = '';
  let bestScore = -Infinity;
  for (const [raw, commerces] of map) {
    const name = raw.trim();
    if (!name || NO_BRAND_RE.test(name)) continue;
    const key = brandKey(name);
    const score =
      (key && descKey.includes(` ${key} `) ? 100 : 0) - (COMPANY_RE.test(name) ? 50 : 0) + commerces.size * 10 + Math.min(name.length, 20) / 100;
    if (score > bestScore) [best, bestScore] = [name, score];
  }
  return best;
}

/** "07791234567890" -> "7791234567890" (GTIN-14 con cero adelante = EAN-13). */
function normalizeBarcode(raw: string): string | null {
  let code = (raw ?? '').trim();
  if (code.length === 14 && code.startsWith('0')) code = code.slice(1);
  return isValidBarcode(code) ? code : null;
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function main() {
  if (!isDayName(dayName)) throw new Error(`Día inválido "${dayName}" (lunes, martes, ..., domingo)`);
  const prisma = OFFLINE ? null : new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });

  // ── Rubros y marcas ────────────────────────────────────────────────────────
  const categories = prisma
    ? await prisma.catalogCategory.findMany({ where: { isActive: true, isDeleted: false }, orderBy: { order: 'asc' } })
    : DEFAULT_CATEGORIES.map((c) => ({ ...c, id: c.slug }));
  if (!categories.length) throw new Error('No hay rubros activos: corré npm run db:seed');
  const categoryName = new Map<string, string>(categories.map((c) => [c.id, c.name] as [string, string]));
  const classifier = new CategoryClassifier(categories, ALWAYS_EXCLUDE);

  const brands = new Map<string, BrandRef>();
  if (prisma) {
    for (const b of await prisma.catalogBrand.findMany({ select: { id: true, key: true, isFeatured: true } })) brands.set(b.key, b);
  }
  const isFeaturedKey = featuredBrandMatcher(
    prisma ? [...brands].filter(([, b]) => b.isFeatured).map(([k]) => k) : FEATURED_BRANDS.map(brandKey),
  );

  // Productos con rubro elegido a mano: entran aunque las palabras clave no los clasifiquen.
  const locked = new Map<string, string>();
  if (prisma) {
    for (const p of await prisma.catalogProduct.findMany({
      where: { categoryLocked: true, categoryId: { not: null } },
      select: { barcode: true, categoryId: true },
    })) {
      locked.set(p.barcode, p.categoryId!);
    }
  }

  const run = prisma && !DRY_RUN ? await prisma.catalogSyncRun.create({ data: { source: `SEPA ${dayName}` } }) : null;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benqui-sepa-'));
  try {
    // ── Lectura ──────────────────────────────────────────────────────────────
    const zip = await getSepaZip(workDir, dayName);
    const commerceZips = await extractCommerceZips(zip, path.join(workDir, 'inner'));
    const collected = new Map<string, Collected>();
    const rejected = new Set<string>();
    let rowsRead = 0;
    const started = Date.now();

    await forEachSepaRow(commerceZips, ({ row, province, commerce }) => {
      rowsRead++;
      if (rowsRead % 2_000_000 === 0) console.log(`[sync] ${(rowsRead / 1e6).toFixed(0)}M filas, ${collected.size} productos...`);
      if (row['productos_ean'] !== '1') return;
      const price = Number(row['productos_precio_lista']);
      if (!(price > 0)) return;
      const raw = row['id_producto'];
      // El rechazo es por comercio: otra cadena puede describir mejor el mismo producto.
      const rejectKey = `${commerce}|${raw}`;
      if (rejected.has(rejectKey)) return;
      const barcode = normalizeBarcode(raw);
      if (!barcode) {
        rejected.add(rejectKey);
        return;
      }
      let item = collected.get(barcode);
      if (!item) {
        const desc = row['productos_descripcion'].trim();
        const categoryId = locked.get(barcode) ?? classifier.classify(desc);
        if (!categoryId) {
          rejected.add(rejectKey);
          return;
        }
        item = {
          categoryId,
          descriptions: new Map(),
          brands: new Map(),
          cols: {
            referenceQty: row['productos_cantidad_referencia'] ?? '',
            referenceUnit: row['productos_unidad_medida_referencia'] ?? '',
            presentationQty: row['productos_cantidad_presentacion'] ?? '',
            presentationUnit: row['productos_unidad_medida_presentacion'] ?? '',
          },
          pricesByProvince: new Map(),
        };
        collected.set(barcode, item);
      }
      bump(item.descriptions, row['productos_descripcion'].trim().replace(/\s+/g, ' '));
      addBrandVote(item.brands, (row['productos_marca'] ?? '').trim(), commerce);
      const prov = province ?? '_';
      const list = item.pricesByProvince.get(prov);
      if (list) list.push(price);
      else item.pricesByProvince.set(prov, [price]);
    });
    console.log(`[sync] ${rowsRead} filas leídas en ${((Date.now() - started) / 1000).toFixed(0)} s; ${collected.size} productos clasificados`);

    // ── Agregacion ───────────────────────────────────────────────────────────
    const now = new Date();
    const products: {
      barcode: string;
      name: string;
      brandName: string;
      brandKey: string;
      categoryId: string;
      presentationQty: number | null;
      presentationUnit: string | null;
      referencePrice: number;
      minPrice: number;
      maxPrice: number;
      provincePrices: Record<string, string>;
      storeCount: number;
    }[] = [];
    for (const [barcode, item] of collected) {
      const all = [...item.pricesByProvince.values()].flat();
      if (all.length < MIN_STORES) continue;
      const desc = bestVariant(item.descriptions, cleanDescription);
      // Manda la descripcion mas completa: la primera vista pudo venir recortada ("Pvo P/helado")
      // y la completa puede caer en una exclusion ("Polvo para preparar helado").
      const categoryId = locked.get(barcode) ?? classifier.classify(desc);
      if (!categoryId) continue;
      const national = summarize(all);
      if (!national) continue;
      const provincePrices: Record<string, string> = {};
      for (const [prov, prices] of item.pricesByProvince) {
        if (prov === '_') continue;
        const s = summarize(prices);
        if (s) provincePrices[prov] = s.median.toFixed(2);
      }
      const brandName = bestBrand(item.brands, desc);
      const presentation = detectPresentation(normalizeText(desc), item.cols);
      products.push({
        barcode,
        name: prettyName(desc).slice(0, 200),
        brandName: prettyName(brandName).slice(0, 120),
        brandKey: brandKey(brandName).slice(0, 120),
        categoryId,
        presentationQty: presentation?.qty ?? null,
        presentationUnit: presentation?.unit ?? null,
        referencePrice: national.median,
        minPrice: national.min,
        maxPrice: national.max,
        provincePrices,
        storeCount: all.length,
      });
    }
    collected.clear();
    console.log(`[sync] ${products.length} productos con ${MIN_STORES}+ sucursales`);

    printReport(products, categoryName, (key) => brands.get(key)?.isFeatured ?? isFeaturedKey(key));
    if (process.env.SYNC_DUMP_PATH) {
      fs.writeFileSync(process.env.SYNC_DUMP_PATH, JSON.stringify(products));
      console.log(`[sync] Productos volcados en ${process.env.SYNC_DUMP_PATH}`);
    }

    if (!prisma || DRY_RUN) {
      console.log('[sync] --dry-run: no se escribió nada en la base');
      return;
    }

    // ── Escritura ────────────────────────────────────────────────────────────
    const newBrands = new Map<string, string>();
    for (const p of products) if (p.brandKey && !brands.has(p.brandKey)) newBrands.set(p.brandKey, p.brandName);
    for (const chunk of chunks([...newBrands], 1000)) {
      await prisma.catalogBrand.createMany({
        data: chunk.map(([key, name]) => ({ key, name, isFeatured: isFeaturedKey(key) })),
        skipDuplicates: true,
      });
    }
    for (const b of await prisma.catalogBrand.findMany({ select: { id: true, key: true, isFeatured: true } })) brands.set(b.key, b);
    console.log(`[sync] ${newBrands.size} marcas nuevas`);

    const existing = new Map(
      (await prisma.catalogProduct.findMany({ select: { id: true, barcode: true, referencePrice: true, source: true } })).map((p) => [
        p.barcode,
        p,
      ]),
    );

    for (const chunk of chunks(products, 500)) {
      const values = chunk.map(
        (p) => Prisma.sql`(gen_random_uuid(), ${p.barcode}, ${p.name}, ${searchText(p.name, p.brandName, p.barcode)},
          ${brands.get(p.brandKey)?.id ?? null}::uuid,
          ${p.categoryId}::uuid, ${p.presentationQty}::numeric, ${p.presentationUnit}, ${p.referencePrice}::numeric,
          ${p.minPrice}::numeric, ${p.maxPrice}::numeric, ${JSON.stringify(p.provincePrices)}::jsonb, ${p.storeCount}::int,
          ${now}, ${now}, ${now}, ${now})`,
      );
      await prisma.$executeRaw`
        INSERT INTO catalog_products (id, barcode, name, search_text, brand_id, category_id, presentation_qty, presentation_unit,
          reference_price, min_price, max_price, province_prices, store_count, price_updated_at, last_seen_at, created_at, updated_at)
        VALUES ${Prisma.join(values)}
        ON CONFLICT (barcode) DO UPDATE SET
          name = EXCLUDED.name,
          search_text = EXCLUDED.search_text,
          brand_id = EXCLUDED.brand_id,
          category_id = CASE WHEN catalog_products.category_locked THEN catalog_products.category_id ELSE EXCLUDED.category_id END,
          presentation_qty = EXCLUDED.presentation_qty,
          presentation_unit = EXCLUDED.presentation_unit,
          reference_price = EXCLUDED.reference_price,
          min_price = EXCLUDED.min_price,
          max_price = EXCLUDED.max_price,
          province_prices = EXCLUDED.province_prices,
          store_count = EXCLUDED.store_count,
          price_updated_at = EXCLUDED.price_updated_at,
          last_seen_at = EXCLUDED.last_seen_at,
          updated_at = EXCLUDED.updated_at
        WHERE catalog_products.source = 'SEPA'`;
    }

    const history = products
      .map((p) => ({ p, prev: existing.get(p.barcode) }))
      .filter(({ p, prev }) => prev && prev.source === 'SEPA' && priceChanged(Number(prev.referencePrice), p.referencePrice))
      .map(({ p, prev }) => ({ productId: prev!.id, previousPrice: prev!.referencePrice, price: p.referencePrice, syncRunId: run!.id }));
    for (const chunk of chunks(history, 2000)) await prisma.catalogPriceHistory.createMany({ data: chunk });

    const created = products.filter((p) => !existing.has(p.barcode)).length;
    const demo = await rebuildDemoSelection(prisma);
    console.log(`[sync] ${created} nuevos, ${products.length - created} actualizados, ${history.length} cambios de precio, ${demo.selected} en el demo`);

    await prisma.catalogSyncRun.update({
      where: { id: run!.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        rowsRead,
        productsSeen: products.length,
        productsCreated: created,
        productsUpdated: products.length - created,
        pricesChanged: history.length,
      },
    });
  } catch (err) {
    if (prisma && run) {
      await prisma.catalogSyncRun
        .update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), error: String((err as Error).stack ?? err).slice(0, 4000) } })
        .catch(() => undefined);
    }
    throw err;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
    await prisma?.$disconnect();
  }
}

/** Resumen por rubro: cantidad de productos y los mas masivos (★ = marca destacada, entra al demo). */
function printReport(
  products: { categoryId: string; name: string; brandName: string; brandKey: string; storeCount: number; referencePrice: number }[],
  categoryName: Map<string, string>,
  isFeatured: (key: string) => boolean,
) {
  const top = process.env.SYNC_REPORT_TOP !== undefined ? Number(process.env.SYNC_REPORT_TOP) || 0 : 12;
  for (const [id, name] of categoryName) {
    const list = products.filter((p) => p.categoryId === id).sort((a, b) => b.storeCount - a.storeCount);
    const featured = list.filter((p) => isFeatured(p.brandKey)).length;
    console.log(`\n== ${name}: ${list.length} productos (${featured} de marcas destacadas)`);
    for (const p of list.slice(0, top)) {
      console.log(`   ${isFeatured(p.brandKey) ? '★' : ' '} ${String(p.storeCount).padStart(5)}  $${p.referencePrice.toFixed(2).padStart(10)}  ${p.name}  [${p.brandName}]`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('[sync] Error:', err);
  process.exit(1);
});
