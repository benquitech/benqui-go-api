# Benqui Go API

API NestJS + Prisma + PostgreSQL del punto de venta Benqui Go (mismas convenciones y seguridad que `fireextracking-api`).

Esta primera versión tiene:

- **Seguridad**: usuarios, roles y permisos, con login JWT + refresh token. Bloquea la cuenta tras 5 intentos fallidos y limita los intentos por IP.
- **Catálogo de precios de referencia**: unos 27.000 productos de kiosco y almacén con código de barras. El precio sale de lo que informan los supermercados a SEPA / Precios Claros. Se actualiza solo una vez por día, sin notificaciones.
- **Acceso para el demo** (`benqui-go-demo`): token temporal de solo lectura que ve **10 productos por rubro**, todos de marcas conocidas.

El diseño completo del punto de venta (ventas, caja, stock, fiado) está en [DISENO_TABLAS.md](DISENO_TABLAS.md). Cómo consumir la API desde el front está en [FRONT_GUIA.md](FRONT_GUIA.md).

## Puesta en marcha

1. `npm install`
2. Copiar `.env.example` a `.env` y completar `DATABASE_URL`, `DIRECT_URL`, los secretos JWT, `DEMO_ACCESS_KEY` y `SEED_ADMIN_PASSWORD`.
3. `npx prisma migrate deploy`: crea las tablas.
4. `npm run db:seed`: carga roles, permisos, el usuario administrador, los 9 rubros del demo con sus palabras clave y unas 350 marcas conocidas.
5. `npm run sync:catalog`: descarga el ZIP de SEPA del día (~330 MB) y llena el catálogo. Tarda 2 a 3 minutos.
6. `npm run start:dev`: la API queda en `http://localhost:3000/api` y Swagger en `http://localhost:3000/api/docs`.

## Despliegue

- **Vercel (API)**: igual que fireextracking. El build ejecuta `vercel-build` (`prisma generate && prisma migrate deploy && nest build`), así que las migraciones se aplican solas. Variables a configurar en Vercel:
  - **Base de datos y JWT:** `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
  - **Front y demo:** `FRONTEND_URL` (la URL del demo), `DEMO_ACCESS_KEY`.
  - **Swagger:** `SWAGGER_USER`, `SWAGGER_PASSWORD`.
  - `NODE_ENV=production`.
- **Sincronización (tarea programada de Windows)**: corre todos los días a las 10:30 en una PC en Argentina, con el `.env` local (usa `DIRECT_URL`).
  - Crearla o cambiar la hora: `powershell -ExecutionPolicy Bypass -File scripts\register-sync-task.ps1 -At 10:30`. Crea la tarea "BenquiGo - Sync catalogo SEPA", que ejecuta [scripts/sync-catalog-task.ps1](scripts/sync-catalog-task.ps1).
  - Logs: `logs/sync-AAAA-MM-DD.log` (se guardan 30 días). Cada corrida también queda en `GET /api/catalog/sync-runs`.
  - Si la PC está apagada a esa hora, corre al prenderla. Solo corre con la sesión de Windows iniciada.

La sincronización **no corre en Vercel** porque procesa un ZIP de ~330 MB con ~15 millones de filas. Tampoco corre en **GitHub Actions**: el sitio de SEPA (datos.produccion.gob.ar) responde 403 a los servidores de GitHub.

## Catálogo de precios de referencia

### De dónde salen los precios

El [dataset SEPA](https://datos.produccion.gob.ar/dataset/sepa-precios) (Ministerio de Producción, CC-BY 4.0) publica cada día los precios de lista de unas 2.700 sucursales de supermercados de todo el país. Por cada producto, el script [scripts/sync-catalog.ts](scripts/sync-catalog.ts):

1. Toma solo productos con **código de barras real** (EAN válido).
2. Lo ubica en un **rubro** por las palabras clave de su descripción (ver *Rubros*). Si no encaja en ninguno, el producto no entra.
3. Exige que lo informen al menos `SYNC_MIN_STORES` sucursales (3 por defecto).
4. Calcula el **precio de referencia** (mediana nacional), el mínimo, el máximo y la mediana por provincia. Antes descarta los valores atípicos (más de 3 veces por encima o por debajo de la mediana).
5. Elige el nombre más completo entre las cadenas, porque algunas recortan la descripción a 20 caracteres, y la marca que informan más cadenas.
6. Guarda los productos con un upsert por código de barras. Cada cambio de precio de al menos 0,5% queda en `catalog_price_history`.
7. Recalcula los productos visibles del demo y registra la corrida en `catalog_sync_runs` (`GET /api/catalog/sync-runs`).

Para probar sin tocar la base:

```bash
npm run sync:catalog -- --offline   # sin base: rubros y marcas por defecto, muestra el resumen por rubro
npm run sync:catalog -- --dry-run   # con los rubros y marcas de la base, sin escribir
npm run test:classify               # pruebas del clasificador, marcas, presentación y selección del demo
```

### Rubros

Son los mismos del demo, con los mismos colores e iconos: Bebidas, Golosinas, Galletitas y snacks, Cigarrillos, Almacén, Lácteos, Helados, Perfumería y limpieza, Varios. Cada uno tiene:

- `keywords`: palabras clave como "gaseosa", "alfajor" o "papas fritas". Gana la que aparece **más al principio** de la descripción, así que "Galletitas de chocolate" va a snacks y no a golosinas.
- `excludeKeywords`: palabras que sacan al producto de ese rubro, como "agua oxigenada" en Bebidas.

Se editan con `PATCH /api/catalog/categories/:id`. Para aplicar los cambios sin esperar a la próxima sincronización está `POST /api/catalog/reclassify`. Si un producto cae mal, se le fija el rubro a mano (`PATCH /api/catalog/products/:id` con `categoryId`) y la sincronización ya no lo cambia.

**Cigarrillos:** SEPA casi no informa cigarrillos, porque los supermercados no los reportan. Ese rubro queda vacío hasta cargarlos a mano con `POST /api/catalog/products`. Los productos manuales (`source: MANUAL`) no los toca la sincronización.

### Qué ve el demo

Por cada rubro entran `DEMO_PRODUCTS_PER_CATEGORY` productos (10 por defecto), elegidos así:

1. Los fijados a mano por el administrador (`isPinned`).
2. Los de **marcas destacadas** (empresas conocidas como Coca-Cola, Arcor, La Serenísima o Sedal), de más a menos masivos según cuántas sucursales los venden. Se toman como máximo 2 por marca para que haya variedad.

Las marcas sin destacar, como las marcas propias de los supermercados, nunca entran al demo. Para sumar una se usa `PATCH /api/catalog/brands/:id` con `{ "isFeatured": true }`.

## Seguridad

Es la misma que fireextracking-api:

- **Acceso:** guard JWT global (todo exige token salvo `@Public()`) y roles (`Administrador`, `Cajero`).
- **Contraseñas y tokens:** argon2 para las contraseñas y para el refresh token guardado.
- **Login:** bloqueo de 15 minutos tras 5 intentos fallidos y límite de 10 intentos por minuto por IP.
- **Validación:** `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`, así que rechaza campos que no existen.
- **CORS:** limitado a `FRONTEND_URL`.
- **Swagger:** con usuario y clave en producción.

### Acceso del demo

El demo no tiene usuario. Guarda una clave en su `environment` y la canjea en `POST /api/demo/session` por un **token Bearer de 2 horas** con el rol `Demo`.

- **Lo que puede hacer el token:**
  - Solo entra a los endpoints marcados con `@AllowDemo()`: consultas del catálogo, rubros y provincias. Cualquier otro endpoint responde 403, también los que se agreguen en el futuro, salvo que se marquen a propósito.
  - Solo ve los productos del demo y sin los campos de administración.
- **Límites por IP:** 10 canjes de clave por minuto y 120 consultas al catálogo por minuto.
- **Rotación:** si la clave se filtra, se cambia `DEMO_ACCESS_KEY` en Vercel y la vieja deja de servir al instante.

¿Por qué Bearer y no cookie? El front y la API viven en dominios distintos de `vercel.app`. Para el navegador es una cookie de terceros, y Safari, Firefox y Chrome las bloquean o las van a bloquear. El Bearer funciona en todos los navegadores y es lo mismo que ya usa el login normal.

> La clave del demo **no es un secreto**. Todo lo que está en el `environment` de Angular termina en el JavaScript que descarga el navegador. La protección real está en otro lado:
> - el token solo puede leer los 80 productos del demo;
> - CORS no deja que otra web lo use desde un navegador;
> - hay límites por IP;
> - la clave se puede rotar.
>
> El resto del catálogo y la administración siguen exigiendo un usuario real.

## Endpoints principales

| Método | Ruta | Quién | Qué |
|---|---|---|---|
| POST | `/api/demo/session` | público | `{ key }` → `{ accessToken, expiresIn, limits }` |
| POST | `/api/auth/login` · `refresh` · `logout` · `change-password` | — | Igual que fireextracking |
| GET | `/api/catalog/categories` | todos + demo | Rubros con cantidad de productos |
| GET | `/api/catalog/products` | todos + demo | `?category=bebidas&search=&province=AR-A&page=&limit=` |
| GET | `/api/catalog/products/barcode/:barcode` | todos + demo | Busca por código de barras (404 si no está) |
| GET | `/api/catalog/products/:id` | todos + demo | Detalle: precios por provincia e historial |
| GET | `/api/catalog/provinces` | todos + demo | Códigos de provincia |
| POST/PATCH/DELETE | `/api/catalog/products[/:id]` | admin | Alta manual, fijar rubro, fijar en el demo, ocultar |
| POST/PATCH/DELETE | `/api/catalog/categories[/:id]` | admin | Rubros y palabras clave |
| POST | `/api/catalog/reclassify` | admin | Reaplica las palabras clave |
| GET/PATCH | `/api/catalog/brands[/:id]` | admin | Marcas destacadas |
| GET | `/api/catalog/demo` · POST `/api/catalog/demo/rebuild` | admin | Selección del demo |
| GET | `/api/catalog/sync-runs` | admin | Estado de las sincronizaciones |
| GET | `/api/health` | público | Estado de la API y la base |

Los montos se devuelven como string con 2 decimales (`"1500.00"`), igual que en el resto del diseño.
