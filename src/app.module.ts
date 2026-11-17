import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DemoModule } from './demo/demo.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Limites por IP. Cada controller elige el suyo con @Throttle (login y demo: 10/min; catalogo: 120/min).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }]),
    PrismaModule,
    AuthModule,
    DemoModule,
    CatalogModule,
  ],
  controllers: [HealthController],
  providers: [
    // Todo exige token salvo @Public(); el token del demo solo entra donde hay @AllowDemo().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
