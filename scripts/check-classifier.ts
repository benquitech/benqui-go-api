/**
 * Pruebas rapidas de la logica del catalogo (sin base ni red): npm run test:classify
 * Sirve para probar palabras clave nuevas antes de cambiarlas en la base.
 */
import * as assert from 'assert';
import { CategoryClassifier } from '../src/catalog/logic/classifier';
import { ALWAYS_EXCLUDE, DEFAULT_CATEGORIES } from '../src/catalog/logic/defaults';
import { selectDemoProducts } from '../src/catalog/logic/demo-selection';
import { featuredBrandMatcher } from '../src/catalog/logic/brands';
import { detectPresentation, formatPresentation } from '../src/catalog/logic/quantity';
import { brandKey, isValidBarcode, normalizeText, prettyName } from '../src/catalog/logic/text';

const classifier = new CategoryClassifier(DEFAULT_CATEGORIES.map((c) => ({ ...c, id: c.slug })), ALWAYS_EXCLUDE);
const cases: [string, string | null][] = [
  ['GASEOSA COCA COLA ORIGINAL 354CC', 'bebidas'],
  ['Agua sin Gas Aquarius Pomelo Bot 1.5 Ltr', 'bebidas'],
  ['AGUA OXIGENADA 10 VOL X 250 ML', 'limpieza'],
  ['Amargo Serrano Cero Pet, Terma, 1350 cm3', 'bebidas'],
  ['Vino Tinto Gato Negro Malbec 750 ml', 'bebidas'],
  ['GALLETITAS CHOCOLATE OREO X 118 GR', 'snacks'],
  ['Gall.dce C/chip Chocolate Cadbury Pepitos Paq 119 Grm', 'snacks'],
  ['ALFAJOR TRIPLE CHOCOLATE GUAYMALLEN', 'golosinas'],
  ['Chocolate Arcor con Leche Tab 25 Grm', 'golosinas'],
  ['HELADO DE CHOCOLATE FRIGOR 1 KG', 'helados'],
  ['Polvo P/prep.helado Sab. Chocolate Exquisita Sob 55 Grm', null],
  ['Leche Chocolatada Cindor 1 lt', 'lacteos'],
  ['Leche INF.1 Profutura 6 a 12 Meses Nutrilon', null],
  ['Yog.bat.p/desc.sab.vainilla Ser Calci+ Pot 120 Grm', 'lacteos'],
  ['Aromatiz,d/amb.liq. Vainilla Glade 42 ml', 'limpieza'],
  ['YERBA MATE PLAYADITO 1 KG', 'almacen'],
  ['SALSA DE TOMATE', 'almacen'],
  ['SALAME MILAN', null],
  ['Alimento Gatitos Humedo Pollo Leche 85gr', null],
  ['PILA ALCALINA DURACELL AA X2', 'varios'],
  ['Cep.dental Extra Suave Carbón Colgate Bli 2 uni', 'limpieza'],
  ['Carbon Vegetal Bolsa 4 kg', 'varios'],
  ['Shampoo Crema Balance Sedal Bot 340 ml', 'limpieza'],
];
for (const [desc, expected] of cases) assert.strictEqual(classifier.classify(desc), expected, `"${desc}"`);

assert.ok(isValidBarcode('7790895000997'));
assert.ok(!isValidBarcode('7790895000998'));
assert.strictEqual(brandKey('COCA-COLA'), 'coca cola');
assert.strictEqual(prettyName('GALLETITAS BOCA DE DAMA TERRABUSI X 170 GRS'), 'Galletitas Boca de Dama Terrabusi x 170 grs');

const featured = featuredBrandMatcher(['coca cola', 'cabrales', 'ser']);
assert.ok(featured('coca cola zero'));
assert.ok(featured('super cabrales'));
assert.ok(featured('ser'));
assert.ok(!featured('serenata'));
assert.ok(!featured('pepsi'));

const pres = (desc: string, cols = {}) => {
  const p = detectPresentation(normalizeText(desc), cols);
  return formatPresentation(p?.qty ?? null, p?.unit ?? null);
};
assert.strictEqual(pres('Agua sin Gas Aquarius Pomelo Bot 1.5 Ltr'), '1,5 l');
assert.strictEqual(pres('Fernet Branca Bot 750 cc', { referenceQty: '1', referenceUnit: 'LTR' }), '750 ml');
assert.strictEqual(pres('Gomitas Mogul Ositos Paq 30 Grm'), '30 g');
assert.strictEqual(pres('Alfajor x 6 un'), '6 u');
assert.strictEqual(pres('Chicle Beldent', { presentationQty: '1', presentationUnit: 'UNI' }), '1 u');

const demo = selectDemoProducts(
  [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `coca${i}`, categoryId: 'b', brandId: 'coca', brandFeatured: true, isPinned: false, storeCount: 100 - i })),
    { id: 'pepsi', categoryId: 'b', brandId: 'pepsi', brandFeatured: true, isPinned: false, storeCount: 50 },
    { id: 'propia', categoryId: 'b', brandId: 'super', brandFeatured: false, isPinned: false, storeCount: 999 },
    { id: 'fijado', categoryId: 'b', brandId: 'x', brandFeatured: false, isPinned: true, storeCount: 1 },
  ],
  4,
);
assert.deepStrictEqual([...demo.keys()], ['fijado', 'coca0', 'coca1', 'pepsi']);

console.log(`OK: ${cases.length} clasificaciones y pruebas de marcas, presentación y demo`);
