// Presentacion de un producto (500 ml, 118 g, 6 unidades) a partir de la descripcion y las
// columnas de SEPA. Adaptado de chef-cost-api/scripts/sepa/quantity.ts.

export type PresentationUnit = 'g' | 'ml' | 'unit';

export interface Presentation {
  unit: PresentationUnit;
  qty: number;
}

/** Codigos de unidad que usan las cadenas en SEPA -> unidad base y factor. */
const UNIT_CODES: Record<string, { unit: PresentationUnit; factor: number }> = {
  GRM: { unit: 'g', factor: 1 }, GRS: { unit: 'g', factor: 1 }, GR: { unit: 'g', factor: 1 }, 'GR.': { unit: 'g', factor: 1 },
  G: { unit: 'g', factor: 1 }, KGM: { unit: 'g', factor: 1000 }, KGR: { unit: 'g', factor: 1000 }, KG: { unit: 'g', factor: 1000 },
  MLT: { unit: 'ml', factor: 1 }, ML: { unit: 'ml', factor: 1 }, 'ML.': { unit: 'ml', factor: 1 }, CMQ: { unit: 'ml', factor: 1 },
  CM3: { unit: 'ml', factor: 1 }, CC: { unit: 'ml', factor: 1 }, 'CC.': { unit: 'ml', factor: 1 },
  LTR: { unit: 'ml', factor: 1000 }, LTS: { unit: 'ml', factor: 1000 }, LT: { unit: 'ml', factor: 1000 }, 'LT.': { unit: 'ml', factor: 1000 },
  L: { unit: 'ml', factor: 1000 }, LITROS: { unit: 'ml', factor: 1000 },
  UNI: { unit: 'unit', factor: 1 }, 'UNI.': { unit: 'unit', factor: 1 }, UND: { unit: 'unit', factor: 1 }, UN: { unit: 'unit', factor: 1 },
  'UN.': { unit: 'unit', factor: 1 }, UNIDAD: { unit: 'unit', factor: 1 }, EA: { unit: 'unit', factor: 1 }, UD: { unit: 'unit', factor: 1 },
};

const MASS_VOLUME_RE =
  /(\d+(?:[.,]\d+)?)\s*-?\s*(kgs?|kgr|kilos?|grs?|grm|gramos|g|cc|cm3|cmq|mls?|ltrs?|lts?|litros?|l)(?![a-z0-9])/g;

const MASS_VOLUME_UNITS: Record<string, Presentation> = {
  kg: { unit: 'g', qty: 1000 }, kgs: { unit: 'g', qty: 1000 }, kgr: { unit: 'g', qty: 1000 },
  kilo: { unit: 'g', qty: 1000 }, kilos: { unit: 'g', qty: 1000 },
  gr: { unit: 'g', qty: 1 }, grm: { unit: 'g', qty: 1 }, grs: { unit: 'g', qty: 1 }, gramos: { unit: 'g', qty: 1 }, g: { unit: 'g', qty: 1 },
  cc: { unit: 'ml', qty: 1 }, cmq: { unit: 'ml', qty: 1 }, cm3: { unit: 'ml', qty: 1 }, ml: { unit: 'ml', qty: 1 }, mls: { unit: 'ml', qty: 1 },
  lt: { unit: 'ml', qty: 1000 }, ltr: { unit: 'ml', qty: 1000 }, ltrs: { unit: 'ml', qty: 1000 }, lts: { unit: 'ml', qty: 1000 }, litro: { unit: 'ml', qty: 1000 },
  litros: { unit: 'ml', qty: 1000 }, l: { unit: 'ml', qty: 1000 },
};

const COUNT_RE = /(\d+)\s*(?:u|un|uni|unid|unidades|uds|saq|saquitos|sobres|rollos)(?![a-wyz])/;

/** Ultimo "numero + unidad de peso/volumen" de la descripcion normalizada ("x 400 gr", "1.5 lt"). */
function fromDescription(descNorm: string): Presentation | null {
  let last: Presentation | null = null;
  for (const m of descNorm.matchAll(MASS_VOLUME_RE)) {
    const value = Number(m[1].replace(',', '.'));
    const u = MASS_VOLUME_UNITS[m[2]];
    if (value > 0 && u) last = { unit: u.unit, qty: value * u.qty };
  }
  return last;
}

function fromColumns(qtyCol: string, unitCol: string): Presentation | null {
  const u = UNIT_CODES[(unitCol ?? '').trim().toUpperCase()];
  const qty = Number((qtyCol ?? '').replace(',', '.'));
  return u && qty > 0 ? { unit: u.unit, qty: qty * u.factor } : null;
}

/**
 * Presentacion del producto. La descripcion manda siempre que traiga peso/volumen: es lo que ve el
 * cliente y las columnas vienen mal cargadas seguido ("0.34 gr" por 340 g, "1 l" para un fernet de
 * 750 cc). Si no, las columnas de presentacion o de referencia, y por ultimo la cantidad de un pack.
 */
export function detectPresentation(
  descNorm: string,
  cols: { referenceQty?: string; referenceUnit?: string; presentationQty?: string; presentationUnit?: string },
): Presentation | null {
  const desc = fromDescription(descNorm);
  const ref = fromColumns(cols.referenceQty ?? '', cols.referenceUnit ?? '');
  const pres = fromColumns(cols.presentationQty ?? '', cols.presentationUnit ?? '');
  if (desc) return round(desc);
  for (const col of [pres, ref]) if (col && col.unit !== 'unit') return round(col);
  const count = descNorm.match(COUNT_RE);
  if (count && Number(count[1]) > 1) return { unit: 'unit', qty: Number(count[1]) };
  return pres ? round(pres) : null;
}

function round(p: Presentation): Presentation {
  return { unit: p.unit, qty: Math.round(p.qty * 1000) / 1000 };
}

/** "500 ml", "1,5 l", "118 g", "1 kg", "6 u". */
export function formatPresentation(qty: number | null, unit: string | null): string | null {
  if (!qty || !unit) return null;
  const fmt = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');
  if (unit === 'g') return qty >= 1000 ? `${fmt(qty / 1000)} kg` : `${fmt(qty)} g`;
  if (unit === 'ml') return qty >= 1000 ? `${fmt(qty / 1000)} l` : `${fmt(qty)} ml`;
  return `${fmt(qty)} u`;
}
