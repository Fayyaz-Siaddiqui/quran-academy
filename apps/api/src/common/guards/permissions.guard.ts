import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@qa/shared-types';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators';
import type { AuthedRequest } from '../types/auth-context';

/** Global guard enforcing @RequirePermissions() and @RequireRoles(). Runs after JwtAuthGuard. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, targets) ?? [];
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets) ?? [];
    if (!required.length && !roles.length) return true;

    const { auth } = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!auth) throw new ForbiddenException('Authentication required');
    if (auth.isSuperAdmin) return true;

    if (roles.length && !roles.some((r) => auth.roles.includes(r))) {
      throw new ForbiddenException('Your role cannot access this resource');
    }
    const missing = required.filter((p) => !auth.permissions.has(p));
    if (missing.length) throw new ForbiddenException({ message: 'Missing permission', missing });
    return true;
  }
}
