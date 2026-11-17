// Datos iniciales del catalogo (los carga prisma/seed.ts). Despues se editan desde la API:
// PATCH /catalog/categories/:id y PATCH /catalog/brands/:id.

export interface DefaultCategory {
  slug: string;
  name: string;
  color: string;
  icon: string;
  keywords: string[];
  excludeKeywords: string[];
}

/**
 * Los mismos rubros, colores e iconos que usa benqui-go-demo (seed.ts: ids "cat-<slug>").
 * Palabras clave sin acentos y en singular (el clasificador acepta el plural).
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    slug: 'bebidas',
    name: 'Bebidas',
    color: '#0ea5e9',
    icon: '🥤',
    keywords: [
      'gaseosa', 'agua', 'agua mineral', 'agua saborizada', 'soda', 'jugo', 'jugo en polvo', 'bebida', 'isotonica',
      'energizante', 'energy drink', 'cerveza', 'vino', 'fernet', 'aperitivo', 'amargo', 'sidra', 'espumante',
      'champagne', 'whisky', 'vodka', 'gin', 'ron', 'licor', 'tonica', 'pomelo', 'cola', 'limonada', 'amargo serrano',
    ],
    excludeKeywords: [
      'agua oxigenada', 'agua de colonia', 'agua micelar', 'agua de rosas', 'agua destilada', 'agua de azahar',
      'agua perfumada', 'colonia', 'shampoo', 'jabon', 'limpiador', 'lavandina', 'detergente', 'desodorante',
      'vinagre', 'aceite', 'yogur', 'yogurt', 'leche', 'helado', 'gelatina', 'mermelada', 'galletita', 'caramelo',
      'chicle', 'pastilla', 'alfajor', 'chocolate',
    ],
  },
  {
    slug: 'golosinas',
    name: 'Golosinas',
    color: '#ec4899',
    icon: '🍬',
    keywords: [
      'alfajor', 'chocolate', 'chocolatin', 'tableta', 'bombon', 'caramelo', 'chicle', 'goma de mascar', 'gomita',
      'pastilla', 'chupetin', 'turron', 'oblea', 'bocadito', 'confite', 'huevo de pascua', 'mantecol', 'garrapinada',
      'malvavisco', 'marshmallow', 'barra de chocolate', 'chocolate con leche', 'confitado', 'grageas', 'gomitas',
      'caramelos masticables', 'barrita de chocolate', 'mini torta', 'torta', 'cubanito', 'mani con chocolate',
    ],
    excludeKeywords: [
      'helado', 'leche chocolatada', 'cacao', 'cobertura', 'reposteria', 'taza', 'para taza', 'baño de', 'bano de',
      'cereal', 'galletita', 'yogur', 'postre', 'budin', 'premezcla', 'bizcochuelo', 'molde', 'vela', 'decoracion',
    ],
  },
  {
    slug: 'snacks',
    name: 'Galletitas y snacks',
    color: '#f59e0b',
    icon: '🍪',
    keywords: [
      'galletita', 'galleta', 'gall', 'galle', 'galletas dulces', 'crackers', 'bizcocho', 'bizcochito', 'tapita', 'vainillas', 'pepa',
      'papas fritas', 'papa frita', 'snack', 'chips', 'palitos', 'chizito', 'conitos', 'mani', 'mani salado',
      'pochoclo', 'nachos', 'tostitos', 'barra de cereal', 'barrita', 'barrita de cereal', 'mix de frutos secos',
      'frutos secos', 'rosquitas', 'grisines', 'tutuca', 'obleas', 'saladas', 'palmeritas', 'maicena',
    ],
    excludeKeywords: [
      'galleta de arroz', 'galletas de arroz', 'pan rallado', 'rebozador', 'congelad', 'prefrita', 'pre frita',
      'noisette', 'bastones', 'para horno', 'mani con chocolate', 'harina', 'fecula', 'almidon', 'pasta de mani',
      'manteca de mani', 'liquida', 'esencia', 'extracto', 'aroma', 'en vaina', 'aromatiz', 'mozzarella', 'muzzarella', 'rebozad',
    ],
  },
  {
    slug: 'cigarrillos',
    name: 'Cigarrillos',
    color: '#64748b',
    icon: '🚬',
    keywords: ['cigarrillo', 'cigarro', 'cigarrito', 'tabaco', 'papel para armar', 'filtros para armar', 'habano'],
    excludeKeywords: ['electronico'],
  },
  {
    slug: 'almacen',
    name: 'Almacén',
    color: '#84cc16',
    icon: '🛒',
    keywords: [
      'yerba', 'yerba mate', 'azucar', 'edulcorante', 'arroz', 'fideo', 'tallarines', 'spaghetti', 'aceite', 'harina',
      'cafe', 'cafe instantaneo', 'te', 'mate cocido', 'cacao', 'sal', 'pure de tomate', 'tomate triturado',
      'tomate perita', 'salsa', 'mayonesa', 'ketchup', 'mostaza', 'polenta', 'lenteja', 'arveja', 'poroto', 'garbanzo',
      'atun', 'caballa', 'sardina', 'picadillo', 'pate', 'pan', 'pan lactal', 'pan rallado', 'tostada', 'galleta de arroz',
      'mermelada', 'dulce de batata', 'dulce de membrillo', 'caldo', 'sopa', 'vinagre', 'aceto', 'choclo', 'durazno',
      'cereal', 'copos', 'avena', 'levadura', 'bizcochuelo', 'premezcla', 'budin', 'pan dulce', 'gelatina', 'flan en polvo',
      'leche en polvo', 'miel', 'aceituna', 'condimento', 'oregano', 'pimienta', 'pimenton', 'aderezo', 'tapas para empanadas',
      'tapa de empanada', 'tapas de tarta', 'pasta', 'ñoquis', 'noquis', 'ravioles', 'capeletinis', 'lomitos de atun',
    ],
    excludeKeywords: [
      'shampoo', 'jabon', 'desodorante', 'crema corporal', 'aceite corporal', 'aceite de bebe', 'aceite para bebe',
      'aceite de motor', 'pasta dental', 'galletita', 'helado', 'alimento para perro', 'alimento para gato', 'perro',
      'gato', 'mascota',
    ],
  },
  {
    slug: 'lacteos',
    name: 'Lácteos',
    color: '#38bdf8',
    icon: '🥛',
    keywords: [
      'leche', 'leche chocolatada', 'yogur', 'yogurt', 'queso', 'queso crema', 'queso rallado', 'manteca', 'crema de leche',
      'crema para batir', 'dulce de leche', 'postre', 'flan', 'ricota', 'muzzarella', 'mozzarella', 'leche cultivada',
      'bebible', 'casancrem', 'serenito', 'danette', 'yog',
    ],
    excludeKeywords: [
      'leche en polvo', 'leche limpiadora', 'leche corporal', 'leche de coco', 'bronceador', 'protector solar',
      'galletita', 'alfajor', 'chocolate', 'helado', 'flan en polvo', 'postre en polvo', 'shampoo', 'jabon',
      'manteca de cacao', 'manteca de mani', 'pan', 'tapa', 'caramelo', 'infantil', 'inf', 'meses', 'formula', 'etapa', 'crecimiento', 'polvo', 'reposteria', 'rocio', 'aero', 'aerosol', 'vegetal',
    ],
  },
  {
    slug: 'helados',
    name: 'Helados',
    color: '#a78bfa',
    icon: '🍦',
    keywords: ['helado', 'palito helado', 'bombon helado', 'cucurucho', 'cono helado', 'paleta helada', 'torta helada', 'hielo'],
    excludeKeywords: ['te helado', 'cafe helado', 'molde', 'heladera', 'polvo', 'pvo', 'p helado', 'para helado', 'para preparar'],
  },
  {
    slug: 'limpieza',
    name: 'Perfumería y limpieza',
    color: '#14b8a6',
    icon: '🧴',
    keywords: [
      'shampoo', 'acondicionador', 'crema de enjuague', 'jabon', 'jabon liquido', 'jabon en polvo', 'detergente',
      'lavandina', 'desodorante', 'antitranspirante', 'pasta dental', 'crema dental', 'cepillo dental', 'cep dental', 'enjuague bucal',
      'papel higienico', 'rollo de cocina', 'servilleta', 'panuelo', 'pañuelo', 'toalla femenina', 'toallita',
      'protector diario', 'tampones', 'afeitadora', 'maquina de afeitar', 'espuma de afeitar', 'limpiador', 'desinfectante',
      'insecticida', 'repelente', 'limp', 'inodoro', 'aromatiz', 'suavizante', 'esponja', 'rejilla', 'trapo', 'bolsa de residuo', 'bolsas de residuos',
      'alcohol en gel', 'alcohol', 'algodon', 'hisopo', 'panal', 'pañal', 'crema corporal', 'crema de manos', 'colonia',
      'perfume', 'limpiavidrios', 'cera', 'quitamanchas', 'aromatizante', 'desodorante de ambiente', 'lustramuebles',
      'jabon de tocador', 'gel de ducha', 'protector solar', 'talco', 'oleo calcareo', 'agua oxigenada', 'apositos',
      'curitas', 'fosforo', 'lavavajilla', 'limpia inodoro', 'pastilla para inodoro', 'cloro', 'quitasarro', 'virulana',
      'cartucho', 'afeitar', 'prestobarba', 'quitamancha', 'pre lavado', 'apresto', 'blanqueador', 'jabon para ropa',
      'perfumina', 'body splash', 'bodyspray', 'body spray', 'deo', 'shampoo', 'tintura', 'coloracion', 'gel fijador',
      'crema para peinar', 'toallas humedas', 'bolsa para residuos',
    ],
    excludeKeywords: ['alimento', 'galletita'],
  },
  {
    slug: 'varios',
    name: 'Varios',
    color: '#f97316',
    icon: '🔋',
    keywords: [
      'pila', 'bateria', 'encendedor', 'preservativo', 'carbon', 'vela', 'lampara', 'cinta adhesiva', 'cargador', 'auricular',
      'cable usb', 'pegamento', 'adhesivo instantaneo', 'cuaderno', 'birome', 'lapicera', 'boligrafo', 'lapiz', 'globo',
      'cotillon', 'linterna',
    ],
    excludeKeywords: ['alimento', 'dental', 'cepillo', 'cep dental', 'barbacoa'],
  },
];

/**
 * Palabras que sacan un producto de cualquier rubro: alimento para mascotas, etc.
 * (el catalogo es para kioscos y almacenes; "alimento para gatos sabor leche" no es un lacteo).
 */
export const ALWAYS_EXCLUDE: string[] = [
  'alimento para perro', 'alimento para gato', 'alimento perro', 'alimento gato', 'alimento gatito', 'alimento balanceado',
  'para mascota', 'gatitos', 'cachorro', 'felino', 'canino', 'piedras sanitarias',
];

/**
 * Marcas conocidas en kioscos y almacenes argentinos (las que puede mostrar el demo).
 * Se comparan normalizadas: "COCA-COLA" -> "coca cola". Una marca de SEPA es destacada si su clave
 * es igual a una de estas o empieza con ella seguida de un espacio ("coca cola zero").
 */
export const FEATURED_BRANDS: string[] = [
  // Bebidas
  'Coca-Cola', 'Coca Cola', 'Pepsi', 'Sprite', 'Fanta', 'Seven Up', '7up', 'Schweppes', 'Paso de los Toros', 'Mirinda',
  'H2OH', 'Villavicencio', 'Villa del Sur', 'Eco de los Andes', 'Glaciar', 'Levite', 'Bonaqua', 'Kin', 'Cepita',
  'Baggio', 'Ades', 'Tang', 'Clight', 'Arcor', 'Quilmes', 'Brahma', 'Stella Artois', 'Heineken', 'Corona', 'Andes',
  'Budweiser', 'Imperial', 'Schneider', 'Patagonia', 'Branca', 'Fernet Branca', 'Gancia', 'Cinzano', 'Speed', 'Red Bull',
  'Monster', 'Gatorade', 'Powerade', 'Manaos', 'Pritty', 'Terma', 'Cunnington', 'Aquarius', 'Saldan', 'Uvita',
  'Toro', 'Termidor', 'Santa Julia', 'Trapiche', 'Norton', 'Dr Lemon', 'Sidra 1888',
  // Golosinas
  'Milka', 'Cadbury', 'Terrabusi', 'Havanna', 'Guaymallen', 'Jorgito', 'Fantoche', 'Bon o Bon', 'Cofler', 'Block',
  'Shot', 'Tofi', 'Felfort', 'Georgalos', 'Mogul', 'Topline', 'Beldent', 'Bazooka', 'Billiken', 'Mentos', 'Halls',
  'Sugus', 'Rocklets', 'Ferrero', 'Ferrero Rocher', 'Kinder', 'Nestle', 'Toblerone', 'Aguila', 'Suchard', 'Tita',
  'Rhodesia', 'Capitan del Espacio', 'Tatin', 'Cachafaz', 'Pepitos', 'Oreo', 'Mantecol', 'Hamlet', 'Bagley', 'Trident',
  'Menthoplus', 'Butter Toffees', 'Lheritier', 'Nugaton', 'Mister Pop', 'Ricolino', 'Fel Fort', 'Godet',
  // Galletitas y snacks
  'Granix', 'Lays', "Lay's", 'Pringles', 'Doritos', 'Cheetos', 'Kesitas', '9 de Oro', 'Don Satur', 'Toddy',
  'Criollitas', 'Traviata', 'Club Social', 'Saladix', 'Pehuamar', 'Krachitos', 'Quaker', 'Cereal Mix', 'Mana', 'Maná',
  'Express', 'Mediatarde', 'Cerealitas', 'Variedad', 'Chocolinas', 'Merengadas', 'Sonrisas', 'Opera', 'Melba', 'Okebon',
  'Hogareñas', 'Hogarenas', 'Rumba', 'Tentaciones', 'Smams', 'Lincoln', 'Macucas', 'Frutigran', 'Mana', 'Twistos',
  'Tutuca', 'Gallo', 'Pozo', 'Marinela', 'Diversion', 'Formis', 'Bimbo', 'Fargo',
  // Cigarrillos
  'Marlboro', 'Philip Morris', 'Lucky Strike', 'Camel', 'Chesterfield', 'Parliament', 'Pall Mall', 'Rothmans', 'Jockey Club',
  'Derby', 'Melbourne', 'Dolchester',
  // Almacen
  'Playadito', 'Taragui', 'Rosamonte', 'Cruz de Malta', 'Amanda', 'La Merced', 'CBSe', 'Union', 'Nobleza Gaucha', 'Canarias',
  'La Tranquera', 'Mananita', 'Ledesma', 'Chango', 'Domino', 'Lucchetti', 'Matarazzo', 'Don Vicente', 'Favorita',
  'Knorr', 'Hellmanns', "Hellmann's", 'Natura', 'Cocinero', 'Cañuelas', 'Canuelas', 'Pureza', 'Blancaflor', 'Morixe',
  'La Virginia', 'Cabrales', 'Nescafe', 'Dolca', 'Green Hills', 'Hileret', 'Chuker', 'La Campagnola', 'Inca', 'Molto',
  'Arcor', 'Noel', 'Dulcor', 'Marolio', 'Lia', 'Ser', 'Molinos', 'Exquisita', 'Godet', 'Royal', 'Kellogg', "Kellogg's",
  'Mamá Cocina', 'Alicante', 'Dos Anclas', 'Celusal', 'Gallo', 'Fanacoa', 'Savora', 'Lucchetti', 'Mendicrim',
  'Taragüí', 'Cruz de Malta', 'Nesquik', 'Chocolino', 'Hilerets', 'Paladini', 'Granja del Sol', 'Swift', 'Gomez Pardo',
  'Carozzi', 'Terrabusi', 'Vitina', 'Tres Arroyos', 'Molinos Ala', 'Adolfo', 'Nucete', 'Arcor', 'Rapiditas', 'La Salteña',
  'La Saltena', 'Mendia',
  // Lacteos
  'La Serenisima', 'La Serenísima', 'Sancor', 'Ilolay', 'Milkaut', 'Danone', 'Yogurisimo', 'Casancrem', 'Tregar',
  'Cindor', 'Tonadita', 'Veronica', 'Manfrey', 'Santa Rosa', 'Mendicrim', 'Finlandia', 'Serenito', 'Danette', 'Ser', 'Las Tres Niñas',
  'Las Tres Ninas', 'Cremigal', 'La Paulina', 'Punta del Agua', 'Vacalin', 'Sancor Bio', 'Actimel', 'Activia',
  // Helados
  'Frigor', 'Grido', 'Pirulo', 'Torpedo', 'Laponia', 'Freddo', 'Bon o Bon Helado', 'Bonobon', 'Mundial', 'Luxor',
  // Perfumeria y limpieza
  'Ala', 'Skip', 'Ariel', 'Ace', 'Magistral', 'Cif', 'Mr Musculo', 'Ayudin', 'Vivere', 'Comfort', 'Dove', 'Rexona', 'Axe',
  'Sedal', 'Pantene', 'Head & Shoulders', 'Head and Shoulders', 'Plusbelle', 'Suave', 'Lux', 'Colgate', 'Kolynos',
  'Oral B', 'Oral-B', 'Elite', 'Higienol', 'Scott', 'Babysec', 'Pampers', 'Huggies', 'Always', 'Kotex', 'Lady Soft',
  'Carefree', 'Nivea', 'Off', 'Raid', 'Fuyi', 'Glade', 'Poett', 'Lysoform', 'Procenex', 'Odex', 'Gillette',
  'Prestobarba', 'Bic', 'Johnson', "Johnson's", 'Veritas', 'Espadol', 'Pinoluz', 'Harpic', 'Querubin', 'Patito',
  'Campanita', 'Sussex', 'Felpita', 'Ola', 'Drive', 'Zorro', 'Lord Cheseline', 'Algabo', 'Tersuave', 'Dento',
  'Dentyne', 'Listerine', 'Sensodyne', 'Lifebuoy', 'Palmolive', 'Rexona Men', 'Impulse', 'Pantene Pro-V',
  'Elvive', "L'Oreal", 'Loreal', 'Fructis', 'Garnier', 'Downy', 'Vim', 'Mortimer',
  // Varios
  'Duracell', 'Energizer', 'Eveready', 'Rayovac', 'Philips', 'Osram', 'Prime', 'Tulipan', 'Tres Patitos', 'Fragata', 'Clipper',
];
