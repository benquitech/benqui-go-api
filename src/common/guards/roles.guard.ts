import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ALLOW_DEMO_KEY } from '../decorators/allow-demo.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { ROLE_DEMO } from '../constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const { user } = context.switchToHttp().getRequest();
    const authUser = user as AuthUser | undefined;

    // El token del demo solo entra donde se lo habilita explicitamente con @AllowDemo().
    if (authUser?.role === ROLE_DEMO) {
      const allowDemo = this.reflector.getAllAndOverride<boolean>(ALLOW_DEMO_KEY, targets);
      if (!allowDemo) throw new ForbiddenException('El demo no tiene acceso a esta acción');
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    if (!authUser || !requiredRoles.includes(authUser.role)) {
      throw new ForbiddenException('No tenés permiso para esta acción');
    }
    return true;
  }
}
