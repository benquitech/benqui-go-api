/** Productos por rubro que puede ver el demo (DEMO_PRODUCTS_PER_CATEGORY, default 10). */
export const DEFAULT_DEMO_PER_CATEGORY = 10;

/** Para que el demo no sean 10 gaseosas Coca-Cola: como maximo esta cantidad por marca (si alcanza). */
export const DEMO_MAX_PER_BRAND = 2;

export interface DemoCandidate {
  id: string;
  categoryId: string;
  brandId: string | null;
  brandFeatured: boolean;
  isPinned: boolean;
  storeCount: number;
}

/**
 * Elige los productos visibles para el demo en cada rubro:
 * 1. Los fijados por el administrador (isPinned).
 * 2. Los de marcas conocidas (isFeatured), de mas a menos masivos (storeCount = sucursales que lo
 *    venden), con un tope por marca para que haya variedad.
 * 3. Si todavia faltan: el resto de marcas conocidas sin tope. Nunca entran marcas no destacadas
 *    (marcas propias de supermercado, desconocidas): si un rubro queda corto, se destaca la marca
 *    (PATCH /catalog/brands/:id) o se fija un producto a mano.
 * Devuelve id -> posicion (1..N) dentro de su rubro.
 */
export function selectDemoProducts(candidates: DemoCandidate[], perCategory: number): Map<string, number> {
  const byCategory = new Map<string, DemoCandidate[]>();
  for (const c of candidates) {
    const list = byCategory.get(c.categoryId) ?? [];
    list.push(c);
    byCategory.set(c.categoryId, list);
  }
  const result = new Map<string, number>();
  for (const list of byCategory.values()) {
    const sorted = [...list].sort((a, b) => b.storeCount - a.storeCount);
    const chosen: DemoCandidate[] = [];
    const taken = new Set<string>();
    const perBrand = new Map<string, number>();
    const take = (c: DemoCandidate) => {
      chosen.push(c);
      taken.add(c.id);
      if (c.brandId) perBrand.set(c.brandId, (perBrand.get(c.brandId) ?? 0) + 1);
    };
    const passes: ((c: DemoCandidate) => boolean)[] = [
      (c) => c.isPinned,
      (c) => c.brandFeatured && (!c.brandId || (perBrand.get(c.brandId) ?? 0) < DEMO_MAX_PER_BRAND),
      (c) => c.brandFeatured,
    ];
    for (const pass of passes) {
      for (const c of sorted) {
        if (chosen.length >= perCategory) break;
        if (!taken.has(c.id) && pass(c)) take(c);
      }
    }
    chosen.forEach((c, i) => result.set(c.id, i + 1));
  }
  return result;
}
