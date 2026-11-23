import type { PermissionKey } from '@qa/shared-types';
import type { Request } from 'express';

/** Identity attached to every authenticated request by JwtAuthGuard. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  academyId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: Set<PermissionKey>;
  isSuperAdmin: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
}

export type AuthedRequest = Request & { auth: AuthContext };
