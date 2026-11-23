import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';

/**
 * Tenant isolation helpers.
 *
 * Every tenant-owned query must be scoped with `academyId(auth)`. Only Super
 * Admins may cross tenants, and only by explicitly naming the target academy
 * with the `X-Academy-Id` header.
 */
@Injectable()
export class TenantService {
  private defaultAcademyId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Academy that a staff/user request operates on. */
  academyId(auth: AuthContext, req?: Request): string {
    const requested = req?.header('x-academy-id');
    if (requested && requested !== auth.academyId) {
      if (!auth.isSuperAdmin) throw new ForbiddenException('Cross-academy access denied');
      return requested;
    }
    if (!auth.academyId) throw new ForbiddenException('Account is not attached to an academy');
    return auth.academyId;
  }

  /** Branch restriction for branch managers; null = all branches in the academy. */
  branchScope(auth: AuthContext): string | null {
    const unrestricted = auth.isSuperAdmin || auth.roles.includes('academy-admin');
    return unrestricted ? null : auth.branchId;
  }

  /** Throws unless the target row belongs to the caller's academy. */
  assertSameAcademy(auth: AuthContext, rowAcademyId: string | null | undefined) {
    if (auth.isSuperAdmin) return;
    if (!rowAcademyId || rowAcademyId !== auth.academyId) throw new NotFoundException();
  }

  /**
   * Academy for anonymous traffic (public website, registration).
   * Resolved from `X-Academy` (slug) when multi-academy is enabled, else the default.
   */
  async publicAcademyId(req?: Request): Promise<string> {
    const slug = req?.header('x-academy');
    if (slug) {
      const academy = await this.prisma.academy.findFirst({ where: { slug, isActive: true }, select: { id: true } });
      if (!academy) throw new NotFoundException('Academy not found');
      return academy.id;
    }
    if (this.defaultAcademyId) return this.defaultAcademyId;
    const academy = await this.prisma.academy.findUnique({
      where: { slug: this.config.get<string>('DEFAULT_ACADEMY_SLUG', 'main') },
      select: { id: true },
    });
    if (!academy) throw new NotFoundException('Default academy is not configured. Run the seeder.');
    this.defaultAcademyId = academy.id;
    return academy.id;
  }
}
