import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators';
import type { AuthContext } from '../types/auth-context';
import { PermissionsGuard } from './permissions.guard';

function ctx(auth: Partial<AuthContext> | undefined, meta: { permissions?: string[]; roles?: string[] }): ExecutionContext {
  const handler = () => undefined;
  Reflect.defineMetadata(PERMISSIONS_KEY, meta.permissions, handler);
  Reflect.defineMetadata(ROLES_KEY, meta.roles, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as unknown as ExecutionContext;
}

const user = (perms: string[], roles: string[] = [], isSuperAdmin = false): Partial<AuthContext> => ({
  userId: 'u1', roles, permissions: new Set(perms) as AuthContext['permissions'], isSuperAdmin,
});

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows routes without requirements', () => {
    expect(guard.canActivate(ctx(user([]), {}))).toBe(true);
  });

  it('requires every listed permission', () => {
    expect(guard.canActivate(ctx(user(['users.read', 'users.update']), { permissions: ['users.read', 'users.update'] }))).toBe(true);
    expect(() => guard.canActivate(ctx(user(['users.read']), { permissions: ['users.read', 'users.update'] }))).toThrow(ForbiddenException);
  });

  it('requires any of the listed roles', () => {
    expect(guard.canActivate(ctx(user([], ['parent']), { roles: ['student', 'parent'] }))).toBe(true);
    expect(() => guard.canActivate(ctx(user([], ['teacher']), { roles: ['student'] }))).toThrow(ForbiddenException);
  });

  it('lets super admins through', () => {
    expect(guard.canActivate(ctx(user([], ['super-admin'], true), { permissions: ['roles.manage'], roles: ['student'] }))).toBe(true);
  });

  it('refuses unauthenticated requests on protected routes', () => {
    expect(() => guard.canActivate(ctx(undefined, { permissions: ['users.read'] }))).toThrow(ForbiddenException);
  });
});
