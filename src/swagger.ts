import { timingSafeEqual } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Swagger UI en /api/docs (mismo setup que fireextracking-api, con assets por CDN).
 * - Local/desarrollo: abierto.
 * - Produccion (NODE_ENV=production): exige usuario y clave (SWAGGER_USER / SWAGGER_PASSWORD);
 *   si no estan definidos, queda deshabilitado.
 * - SWAGGER_ENABLED=false lo apaga siempre.
 */
export function setupSwagger(app: INestApplication) {
  const user = process.env.SWAGGER_USER;
  const pass = process.env.SWAGGER_PASSWORD;
  if (process.env.SWAGGER_ENABLED === 'false') return;
  if (process.env.NODE_ENV === 'production' && !(user && pass)) {
    console.warn('Swagger deshabilitado en producción: definí SWAGGER_USER y SWAGGER_PASSWORD para habilitarlo');
    return;
  }
  if (user && pass) {
    app.use(['/api/docs', '/api/docs-json', '/api/docs-yaml'], (req: any, res: any, next: () => void) => {
      const [scheme, encoded] = String(req.headers.authorization ?? '').split(' ');
      if (scheme === 'Basic' && encoded) {
        const [u, ...rest] = Buffer.from(encoded, 'base64').toString().split(':');
        if (safeEqual(u, user) && safeEqual(rest.join(':'), pass)) return next();
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="Benqui Go API docs"');
      res.status(401).send('Autenticación requerida');
    });
  }

  // El nombre del esquema debe coincidir con @ApiBearerAuth() de los
  // controllers (nombre por defecto "bearer"). Si no coincide, Swagger UI
  // guarda el token pero NO lo adjunta a las peticiones.
  const config = new DocumentBuilder()
    .setTitle('Benqui Go API')
    .setDescription('Punto de venta Benqui Go: seguridad y catálogo de precios de referencia (SEPA)')
    .setVersion('1.0')
    .addServer('/')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
    ],
  });
}
