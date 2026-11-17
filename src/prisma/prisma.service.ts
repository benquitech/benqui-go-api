import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

/**
 * DATABASE_URL puede ser una conexion directa (postgres://, Neon / Vercel Postgres) o una URL de
 * Prisma Postgres / Accelerate (prisma+postgres:// o prisma://). En ese caso se agrega la extension.
 */
function createClient(): PrismaClient {
  const client = new PrismaClient();
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('prisma://') || url.startsWith('prisma+postgres://')) {
    return client.$extends(withAccelerate()) as unknown as PrismaClient;
  }
  return client;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = createClient();

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
