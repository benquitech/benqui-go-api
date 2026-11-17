import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Detras del proxy de Vercel: la IP real del cliente viene en X-Forwarded-For (limite de intentos de login).
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Solo el front propio puede consultar la API desde un navegador. FRONTEND_URL admite varias URLs separadas por coma.
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  });

  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Benqui Go API escuchando en http://localhost:${port}/api`);
  console.log(`CORS permitido para: ${allowedOrigins.join(', ')}`);
}
bootstrap();
