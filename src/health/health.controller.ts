import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Estado de la API y de la base (para monitoreo). No expone datos. */
  @Public()
  @SkipThrottle()
  @Get()
  async health() {
    let database = 'ok';
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }
    return { status: database === 'ok' ? 'ok' : 'degraded', database, time: new Date().toISOString() };
  }
}
