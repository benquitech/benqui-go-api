import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';

/** Intentos fallidos seguidos que bloquean la cuenta, y por cuanto tiempo. */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(userName: string, password: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { userName },
      include: { role: true },
    });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(
        `Demasiados intentos fallidos. Probá de nuevo en ${minutes} minuto${minutes === 1 ? '' : 's'}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      await this.registerFailedAttempt(user.id);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.failedLoginAttempts || user.lockedUntil) {
      await this.prisma.client.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    const tokens = await this.issueTokens(user.id, user.userName, user.role.name);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    const permissions = await this.getPermissionsByRole(user.roleId);
    return {
      user: {
        id: user.id,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions,
      },
      ...tokens,
    };
  }

  /** Suma un intento fallido; al llegar al maximo bloquea la cuenta y reinicia el contador. */
  private async registerFailedAttempt(userId: string) {
    const updated = await this.prisma.client.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.client.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000),
        },
      });
    }
  }

  async logout(userId: string) {
    await this.prisma.client.user.updateMany({
      where: { id: userId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });
    return { success: true };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || user.isDeleted || !user.refreshToken) {
      throw new ForbiddenException('Acceso denegado');
    }
    const matches = await argon2.verify(user.refreshToken, refreshToken);
    if (!matches) {
      throw new ForbiddenException('Acceso denegado');
    }
    const tokens = await this.issueTokens(user.id, user.userName, user.role.name);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await argon2.verify(user.password, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { password: await argon2.hash(newPassword), refreshToken: null },
    });
    return { success: true };
  }

  private async getPermissionsByRole(roleId: string): Promise<string[]> {
    const rolePermissions = await this.prisma.client.rolePermission.findMany({
      where: { roleId, isDeleted: false, permission: { isDeleted: false } },
      include: { permission: { select: { name: true, order: true } } },
      orderBy: { permission: { order: 'asc' } },
    });
    return rolePermissions.map((rp) => rp.permission.name);
  }

  private async issueTokens(
    userId: string,
    userName: string,
    role: string,
  ): Promise<Tokens> {
    const payload: JwtPayload = { sub: userId, userName, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    const hash = await argon2.hash(refreshToken);
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }
}
