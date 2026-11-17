import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { DEMO_USER_NAME, ROLE_DEMO } from '../../common/constants';

export interface JwtPayload {
  sub: string;
  userName: string;
  role: string;
  /** "demo" en los tokens que emite POST /demo/session. */
  typ?: 'demo';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Token del demo: no hay usuario en la base. Solo accede a endpoints con @AllowDemo().
    if (payload.typ === 'demo') {
      return { userId: '', userName: DEMO_USER_NAME, role: ROLE_DEMO };
    }
    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Usuario inactivo o inexistente');
    }
    return { userId: user.id, userName: user.userName, role: user.role.name };
  }
}
