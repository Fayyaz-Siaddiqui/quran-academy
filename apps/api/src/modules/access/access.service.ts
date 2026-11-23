import { Inject, Injectable } from '@nestjs/common';
import { AUTH } from '@qa/config';
import { PermissionKey, SystemRole } from '@qa/shared-types';
import { UserStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';

export interface ResolvedAccess {
  userId: string;
  status: UserStatus;
  academyId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: PermissionKey[];
}

const ACCESS_TTL_SECONDS = 60;
const accessKey = (userId: string) => `access:${userId}`;
const revokedSessionKey = (sessionId: string) => `revoked-session:${sessionId}`;

/**
 * Resolves a user's effective roles/permissions and status, cached in Redis.
 * Any change to roles, permissions or account status MUST call invalidate*().
 */
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async resolve(userId: string): Promise<ResolvedAccess | null> {
    const cached = await this.redis.get(accessKey(userId));
    if (cached) return JSON.parse(cached) as ResolvedAccess;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        status: true,
        academyId: true,
        branchId: true,
        roles: {
          select: {
            role: {
              select: { slug: true, permissions: { select: { permission: { select: { key: true } } } } },
            },
          },
        },
      },
    });
    if (!user) return null;

    const roles = user.roles.map((r) => r.role.slug);
    const permissions = new Set<PermissionKey>();
    for (const r of user.roles) for (const p of r.role.permissions) permissions.add(p.permission.key as PermissionKey);

    const resolved: ResolvedAccess = {
      userId: user.id,
      status: user.status,
      academyId: user.academyId,
      branchId: user.branchId,
      roles,
      permissions: [...permissions],
    };
    await this.redis.set(accessKey(userId), JSON.stringify(resolved), 'EX', ACCESS_TTL_SECONDS);
    return resolved;
  }

  isSuperAdmin(roles: string[]) {
    return roles.includes(SystemRole.SUPER_ADMIN);
  }

  async invalidateUser(userId: string) {
    await this.redis.del(accessKey(userId));
  }

  /** Called after a role's permission set changes. */
  async invalidateRole(roleId: string) {
    const holders = await this.prisma.userRole.findMany({ where: { roleId }, select: { userId: true } });
    if (holders.length) await this.redis.del(...holders.map((h) => accessKey(h.userId)));
  }

  /**
   * Access tokens are stateless JWTs; revoking a session blocks its still-valid
   * access tokens for the remainder of their lifetime.
   */
  async markSessionRevoked(sessionId: string) {
    await this.redis.set(revokedSessionKey(sessionId), '1', 'EX', AUTH.ACCESS_TOKEN_TTL_SECONDS + 60);
  }

  async isSessionRevoked(sessionId: string) {
    return (await this.redis.exists(revokedSessionKey(sessionId))) === 1;
  }
}
