/**
 * Decide si una marca (clave normalizada, ver brandKey) es de una empresa conocida:
 * - igual a una destacada ("coca cola"), o
 * - empieza con una destacada ("coca cola zero"), o
 * - contiene una destacada de 5+ letras como palabra ("super cabrales", "aceite giras cocinero").
 *   Las cortas ("ala", "ser", "off") solo valen exactas o al principio, para no confundir.
 */
export function featuredBrandMatcher(featuredKeys: string[]) {
  const keys = [...new Set(featuredKeys.filter(Boolean))];
  const long = keys.filter((k) => k.length >= 5);
  const set = new Set(keys);
  return (key: string): boolean => {
    if (!key) return false;
    if (set.has(key)) return true;
    if (keys.some((k) => key.startsWith(`${k} `))) return true;
    const padded = ` ${key} `;
    return long.some((k) => padded.includes(` ${k} `));
  };
}
