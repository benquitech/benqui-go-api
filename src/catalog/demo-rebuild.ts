import { PrismaClient } from '@prisma/client';
import { DEFAULT_DEMO_PER_CATEGORY, selectDemoProducts } from './logic/demo-selection';

/** Productos que no aparecen en SEPA hace mas de estos dias no entran al demo (precio viejo). */
const DEMO_MAX_STALE_DAYS = 7;

export function demoPerCategory(): number {
  const n = Number(process.env.DEMO_PRODUCTS_PER_CATEGORY);
  return Number.isInteger(n) && n > 0 && n <= 50 ? n : DEFAULT_DEMO_PER_CATEGORY;
}

/**
 * Recalcula los productos visibles para el demo (in_demo / demo_rank) en una transaccion.
 * Lo llama la sincronizacion al terminar y POST /catalog/demo/rebuild.
 */
export async function rebuildDemoSelection(prisma: PrismaClient, perCategory = demoPerCategory()) {
  const since = new Date(Date.now() - DEMO_MAX_STALE_DAYS * 86400000);
  const rows = await prisma.catalogProduct.findMany({
    where: {
      isHidden: false,
      categoryId: { not: null },
      category: { isActive: true, isDeleted: false },
      OR: [
        { isPinned: true },
        { brand: { isFeatured: true }, OR: [{ source: 'MANUAL' }, { lastSeenAt: { gte: since } }] },
      ],
    },
    select: { id: true, categoryId: true, brandId: true, isPinned: true, storeCount: true, brand: { select: { isFeatured: true } } },
  });
  const selected = selectDemoProducts(
    rows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId!,
      brandId: r.brandId,
      brandFeatured: !!r.brand?.isFeatured,
      isPinned: r.isPinned,
      storeCount: r.storeCount,
    })),
    perCategory,
  );
  await prisma.$transaction([
    prisma.catalogProduct.updateMany({ where: { inDemo: true }, data: { inDemo: false, demoRank: null } }),
    ...[...selected].map(([id, rank]) => prisma.catalogProduct.update({ where: { id }, data: { inDemo: true, demoRank: rank } })),
  ]);
  return { selected: selected.size, perCategory };
}
