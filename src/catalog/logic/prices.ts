export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Precios mas de 3 veces por encima o por debajo de la mediana: errores de carga (precio de un pack, de un kilo...). */
export const OUTLIER_FACTOR = 3;

export interface PriceSummary {
  median: number;
  min: number;
  max: number;
  sampleSize: number;
}

/** Mediana, minimo y maximo descartando valores atipicos. null si no queda ningun precio valido. */
export function summarize(prices: number[]): PriceSummary | null {
  const valid = prices.filter((p) => p > 0 && Number.isFinite(p));
  if (!valid.length) return null;
  const m = median(valid);
  const kept = valid.filter((p) => p >= m / OUTLIER_FACTOR && p <= m * OUTLIER_FACTOR);
  if (!kept.length) return null;
  return { median: round2(median(kept)), min: round2(Math.min(...kept)), max: round2(Math.max(...kept)), sampleSize: kept.length };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Variacion relativa minima del precio de referencia para registrar un cambio en el historial. */
export const PRICE_CHANGE_MIN_RATIO = 0.005;

export function priceChanged(previous: number, current: number): boolean {
  if (!(previous > 0)) return current > 0;
  return Math.abs(current - previous) / previous >= PRICE_CHANGE_MIN_RATIO;
}
