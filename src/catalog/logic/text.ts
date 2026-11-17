/** Minusculas, sin acentos ni espacios repetidos: "Galletitas  Oreo" -> "galletitas oreo". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clave de una marca: sin acentos ni signos. "COCA-COLA" y "Coca Cola" -> "coca cola". */
export function brandKey(brand: string): string {
  return normalizeText(brand)
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** EAN-8, UPC-A (12), EAN-13 o GTIN-14 con digito verificador correcto. */
export function isValidBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  if (/^0+$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Desde la derecha: pesos 3,1,3,1...
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

const LOWER_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'con', 'sin', 'en', 'para', 'por', 'a', 'al', 'x']);
const UNIT_WORDS = new Set(['g', 'gr', 'grs', 'gramos', 'kg', 'kgs', 'ml', 'cc', 'cm3', 'l', 'lt', 'lts', 'un', 'u', 'uni', 'unid', 'mg']);

/**
 * Las cadenas informan las descripciones en mayusculas: "GALLETITAS BOCA DE DAMA TERRABUSI X 170 GRS"
 * -> "Galletitas Boca de Dama Terrabusi x 170 grs". Las palabras con numeros quedan como vienen ("7UP", "500ML" -> "500ml").
 */
export function prettyName(raw: string): string {
  const words = raw.replace(/\s+/g, ' ').trim().split(' ');
  return words
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('es-AR');
      if (/\d/.test(w)) return /^\d+[.,]?\d*[a-z]+\.?$/i.test(w) ? lower : w;
      if (UNIT_WORDS.has(lower.replace(/\.$/, ''))) return lower;
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase('es-AR') + lower.slice(1);
    })
    .join(' ');
}

/** Texto de busqueda de un producto: nombre + marca + codigo, normalizado. */
export function searchText(name: string, brand: string | null | undefined, barcode: string): string {
  return normalizeText(`${name} ${brand ?? ''} ${barcode}`).slice(0, 400);
}
