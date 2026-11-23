import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@qa/shared-types';
import type { AuthContext, AuthedRequest } from '../types/auth-context';

export const IS_PUBLIC_KEY = 'isPublic';
/** Skips authentication. Use for the public website and auth endpoints only. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
/** Requires ALL listed permissions. Enforced by PermissionsGuard. */
export const RequirePermissions = (...permissions: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const ROLES_KEY = 'roles';
/** Requires ANY of the listed role slugs. Prefer permissions; use for persona endpoints (e.g. /students/me). */
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const AUDIT_KEY = 'audit';
export interface AuditMeta {
  action: string;
  entity: string;
  /** Route param that holds the entity id */
  idParam?: string;
}
/** Records a successful mutating request in the audit log. */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().auth;
});
