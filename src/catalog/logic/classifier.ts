import { normalizeText } from './text';

export interface ClassifiableCategory {
  id: string;
  keywords: string[];
  excludeKeywords: string[];
}

interface Term {
  categoryIndex: number;
  term: string;
}

/**
 * Ubica un producto en un rubro por su descripcion.
 *
 * - Cada rubro tiene palabras clave ("gaseosa", "agua mineral", "papas fritas").
 * - Gana la palabra clave que aparece MAS AL PRINCIPIO de la descripcion: las cadenas describen
 *   primero el tipo de producto ("GALLETITAS CHOCOLATE OREO", "HELADO DE CHOCOLATE"), asi que
 *   "chocolate" no se lleva las galletitas ni los helados. A igual posicion gana la mas larga.
 * - Solo cuenta palabra completa (acepta plural): "sal" no matchea "salsa", "te" no matchea "tenedor".
 * - Si la descripcion contiene una palabra excluida del rubro, se prueba con el siguiente candidato.
 */
/** Como queda una descripcion para buscar palabras: minusculas, sin acentos, solo letras y numeros. */
function toSearchable(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9]+/g, ' ').trim();
}

export class CategoryClassifier {
  private readonly terms: Term[] = [];
  private readonly excludes: string[][];
  private readonly ids: string[];

  private readonly globalExcludes: string[];

  /** `alwaysExclude`: palabras que dejan a un producto fuera de todos los rubros (alimento para mascotas). */
  constructor(categories: ClassifiableCategory[], alwaysExclude: string[] = []) {
    this.globalExcludes = alwaysExclude.map(toSearchable).filter(Boolean);
    this.ids = categories.map((c) => c.id);
    this.excludes = categories.map((c) => c.excludeKeywords.map(toSearchable).filter(Boolean));
    categories.forEach((c, categoryIndex) => {
      for (const kw of c.keywords) {
        const term = toSearchable(kw);
        if (term) this.terms.push({ categoryIndex, term });
      }
    });
  }

  /** Id del rubro, o null si ninguno aplica. */
  classify(description: string): string | null {
    const text = ` ${toSearchable(description)} `;
    if (this.globalExcludes.some((ex) => findWord(text, ex) !== -1)) return null;
    let best: { pos: number; len: number; categoryIndex: number }[] = [];
    for (const { categoryIndex, term } of this.terms) {
      const pos = findWord(text, term);
      if (pos === -1) continue;
      best.push({ pos, len: term.length, categoryIndex });
    }
    if (!best.length) return null;
    best = best.sort((a, b) => a.pos - b.pos || b.len - a.len);
    for (const candidate of best) {
      const excluded = this.excludes[candidate.categoryIndex].some((ex) => findWord(text, ex) !== -1);
      if (!excluded) return this.ids[candidate.categoryIndex];
    }
    return null;
  }
}

/**
 * Posicion de `term` como palabra(s) completa(s) dentro de `text` (que viene con espacios a los
 * lados y solo letras/numeros). Acepta plural: "alfajor" encuentra "alfajores".
 */
function findWord(text: string, term: string): number {
  let from = 0;
  for (;;) {
    const i = text.indexOf(` ${term}`, from);
    if (i === -1) return -1;
    const end = i + 1 + term.length;
    for (const suffix of ['', 's', 'es']) {
      if (text.startsWith(suffix, end) && text[end + suffix.length] === ' ') return i;
    }
    from = i + 1;
  }
}
