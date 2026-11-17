import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';
import { DEMO_USER_NAME, ROLE_DEMO } from '../common/constants';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { demoPerCategory } from '../catalog/demo-rebuild';

/** Compara en tiempo constante (hash previo para que el largo de la clave no se filtre). */
function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

/** "2h" / "30m" / "45s" / "3600" -> segundos. */
function toSeconds(value: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) return 7200;
  const n = Number(m[1]);
  return n * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'] ?? 1);
}

@Injectable()
export class DemoService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createSession(key: string) {
    const expected = this.config.get<string>('DEMO_ACCESS_KEY');
    if (!expected) throw new ServiceUnavailableException('El demo está deshabilitado');
    if (!safeEqual(key, expected)) throw new UnauthorizedException('Clave de demo inválida');

    const expiresIn = toSeconds(this.config.get<string>('DEMO_TOKEN_EXPIRES_IN', '2h'));
    const payload: JwtPayload = { sub: DEMO_USER_NAME, userName: DEMO_USER_NAME, role: ROLE_DEMO, typ: 'demo' };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn,
    });
    return {
      accessToken,
      expiresIn,
      user: { userName: DEMO_USER_NAME, role: ROLE_DEMO },
      limits: { productsPerCategory: demoPerCategory() },
    };
  }
}
