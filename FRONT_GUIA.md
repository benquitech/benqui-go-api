# Guía para el front: catálogo de precios de referencia

Esta guía es para integrar `benqui-go-demo` (Angular) con el catálogo de esta API. Base: `environment.apiUrl`, por ejemplo `http://localhost:3000/api`.

> **Ya está integrado en `benqui-go-demo`.** Solo hay que completar `environment.ts`:
> - `apiUrl`: URL de esta API terminada en `/api`.
> - `referenceCatalog.demoKey`: el valor de `DEMO_ACCESS_KEY`.
> - `referenceCatalog.province`: provincia inicial (`AR-A` = Salta, vacío = nacional).
>
> El código está en estos lugares:
> - **Servicio e interceptor:** `src/app/core/reference-catalog.ts`. Canjea la clave por el token, lo renueva solo y repite la consulta si recibe 401.
> - **Pantalla "Precios":** `src/app/pages/prices/prices.ts`. Muestra rubros, búsqueda, provincia y tu precio contra el de referencia, y el admin puede agregar un producto a sus productos.
> - **Sugerencia al dar de alta:** `src/app/pages/products/product-form-modal.ts`. Al escanear un código nuevo ofrece "Usar estos datos".
>
> Sin `demoKey`, el ítem "Precios" no aparece y el alta funciona como antes.

## 1. Entrar como demo

El demo no tiene usuario. Canjea una clave por un token temporal:

```ts
// environment.ts
export const environment = {
  demo: true,
  apiUrl: 'http://localhost:3000/api',
  /** Clave del demo (DEMO_ACCESS_KEY de la API). No es secreta: ver README de la API. */
  demoKey: '...',
};
```

```http
POST /api/demo/session
Content-Type: application/json

{ "key": "<environment.demoKey>" }
```

```json
{
  "accessToken": "eyJ...",
  "expiresIn": 7200,
  "user": { "userName": "demo", "role": "Demo" },
  "limits": { "productsPerCategory": 10 }
}
```

- Mandar el token en cada pedido: `Authorization: Bearer <accessToken>`, con un interceptor HTTP.
- Guardarlo en memoria o en `sessionStorage` junto con su vencimiento (`Date.now() + expiresIn * 1000`).
- Si una consulta responde **401**, el token venció: pedir otro a `/demo/session` y repetir la consulta una vez.
- Si `/demo/session` responde:
  - **401**: la clave cambió y hay que actualizar el environment.
  - **503**: el demo está apagado en la API.
  - **429**: demasiados intentos; esperar un minuto.
- El token del demo recibe **403** en todo lo que no sea consultar el catálogo.

## 2. Rubros

```http
GET /api/catalog/categories
```

```json
[
  { "id": "2a69…", "slug": "bebidas", "demoId": "cat-bebidas", "name": "Bebidas", "color": "#0ea5e9", "icon": "🥤", "order": 1, "productCount": 10 }
]
```

`demoId` coincide con los ids de `core/demo/seed.ts` (`cat-bebidas`, `cat-golosinas`, …), así que el front puede cruzar los rubros sin mapeos. Para el demo, `productCount` es la cantidad que puede ver (hasta 10).

## 3. Productos

```http
GET /api/catalog/products?category=cat-bebidas&search=coca&province=AR-A&page=1&limit=20
```

| Parámetro | Qué hace |
|---|---|
| `category` | Slug (`bebidas`) o id del demo (`cat-bebidas`). También existe `categoryId` (uuid). |
| `search` | Palabras sueltas en el nombre, la marca o el código de barras, sin importar acentos ni mayúsculas. |
| `province` | Provincia del precio (`AR-A` = Salta), la elige el front. Sin este parámetro, o si no hay datos en esa provincia, viene el precio nacional (`priceProvince: null`). |
| `page`, `limit` | Paginación (`limit` de 1 a 100). |

El demo recibe los productos ordenados por rubro y por posición: 80 en total, así que con `limit=100` llegan todos en un solo pedido y se pueden cachear como hace `CatalogStore`.

```json
{
  "data": [
    {
      "id": "392cb2cd-…",
      "barcode": "7790580602000",
      "name": "Pastillas Goma S/fruta Rollo, Mogul, 35 gr",
      "brand": { "id": "f702…", "name": "Mogul" },
      "categoryId": "b4aa…",
      "category": { "id": "b4aa…", "slug": "golosinas", "name": "Golosinas", "color": "#ec4899", "icon": "🍬" },
      "presentation": "35 g",
      "presentationQty": "35.000",
      "presentationUnit": "g",
      "saleUnit": "UNIT",
      "price": "999.00",
      "priceProvince": "AR-A",
      "referencePrice": "945.00",
      "minPrice": "675.00",
      "maxPrice": "1150.00",
      "storeCount": 2529,
      "priceUpdatedAt": "2026-11-16T02:52:02.472Z",
      "source": "SEPA"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 1
}
```

- **Precios:**
  - `price` es el **precio sugerido**: el de la provincia pedida si hay datos ahí, y si no el nacional. En ese caso `priceProvince` viene en `null`.
  - `referencePrice` es la mediana nacional.
  - `minPrice` y `maxPrice` dan el rango entre sucursales.
- **Montos:** llegan como **string** (`"999.00"`) y se convierten a number en la capa HTTP, como dice `models.ts`.
- **`storeCount`:** cuántas sucursales lo venden; sirve como "qué tan conocido es".

## 4. Buscar por código de barras (alta de producto)

Cuando se escanea un código que no está cargado (`products.ts` → `newProduct(barcode)`):

```http
GET /api/catalog/products/barcode/7790895000997?province=AR-A
```

- **200**: el producto con el mismo formato de arriba, más `provincePrices`. Sirve para precargar el formulario:
  - `name` → `name`
  - `category.demoId` → `categoryId`
  - `saleUnit` → `saleUnit`
  - `price` → `salePrice` sugerido (o `costPrice`, y que el margen calcule el precio con `refreshMargin()`)
- **404**: no está en el catálogo de referencia. Para el demo, eso pasa con todo lo que no esté entre sus 80 productos. Se sigue con el alta manual como hoy.

## 5. Detalle

```http
GET /api/catalog/products/:id?province=AR-A
```

Agrega `provincePrices: [{ province, name, price }]` y `history: [{ date, previousPrice, price }]` con los últimos 30 cambios del precio de referencia.

## 6. Errores

Tienen el formato de NestJS que ya maneja `core/api-error.ts`: `{ statusCode, message, error }`, donde `message` puede ser un string o un array.
