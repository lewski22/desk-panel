/**
 * RolesGuard — weryfikacja roli użytkownika (RBAC).
 *
 * Używany razem z dekoratorem @Roles(...). Jeśli endpoint nie ma @Roles,
 * guard przepuszcza bez weryfikacji. Rola OWNER ma dostęp do wszystkiego
 * — jest nadrzędna wobec wszystkich pozostałych ról.
 *
 * backend/src/modules/auth/guards/roles.guard.ts
 */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (user?.role === 'OWNER') return true;
    return required.some(r => r === user?.role);
  }
}
