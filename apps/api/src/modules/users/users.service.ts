import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus, VerificationTokenType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { SystemRole } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import type { AuthContext } from '../../common/types/auth-context';
import { AccessService } from '../access/access.service';
import { TenantService } from '../access/tenant.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { MailService } from '../mail/mail.service';
import { AssignRolesDto, ChangeStatusDto, CreateUserDto, UpdateOwnProfileDto, UpdateUserDto, UserListQueryDto } from './users.dto';

const LIST_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  country: true,
  timezone: true,
  status: true,
  statusReason: true,
  branchId: true,
  lastLoginAt: true,
  createdAt: true,
  emailVerifiedAt: true,
  twoFactorEnabled: true,
  roles: { select: { role: { select: { id: true, slug: true, name: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly access: AccessService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  async list(academyId: string, auth: AuthContext, q: UserListQueryDto) {
    const branch = this.tenant.branchScope(auth);
    const where: Prisma.UserWhereInput = {
      academyId,
      deletedAt: null,
      ...(branch ? { branchId: branch } : q.branchId ? { branchId: q.branchId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { roles: { some: { role: { slug: q.role } } } } : {}),
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: LIST_SELECT, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(flattenRoles), total, page: q.page, pageSize: q.pageSize };
  }

  async get(academyId: string, auth: AuthContext, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, academyId, deletedAt: null },
      select: {
        ...LIST_SELECT,
        preferredLanguage: true,
        studentProfile: true,
        teacherProfile: { include: { availability: true } },
        parentLinks: { select: { child: { select: { id: true, fullName: true, status: true } } } },
        childLinks: { select: { parent: { select: { id: true, fullName: true, email: true, phone: true } } } },
        documents: { select: { id: true, type: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
      },
    });
    if (!user) throw new NotFoundException();
    this.assertBranch(auth, user.branchId);
    return flattenRoles(user);
  }

  /** Staff-created accounts receive a "set your password" email instead of a typed password. */
  async create(academyId: string, auth: AuthContext, dto: CreateUserDto) {
    await this.assertAssignableRoles(auth, academyId, dto.roleIds);
    const branchId = this.tenant.branchScope(auth) ?? dto.branchId ?? null;
    if (branchId) await this.assertBranchInAcademy(academyId, branchId);

    const user = await this.prisma.user.create({
      data: {
        academyId,
        branchId,
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        country: dto.country?.toUpperCase(),
        timezone: dto.timezone,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      select: LIST_SELECT,
    });
    const token = await this.authService.createVerificationToken(user.id, VerificationTokenType.PASSWORD_RESET, 72 * 60);
    await this.mail.send({
      to: dto.email,
      template: 'reset-password',
      data: { name: dto.fullName, url: `${this.config.get('APP_URL')}/reset-password?token=${token}&welcome=1` },
    });
    return flattenRoles(user);
  }

  async update(academyId: string, auth: AuthContext, id: string, dto: UpdateUserDto) {
    const user = await this.findInScope(academyId, auth, id);
    if (dto.branchId) await this.assertBranchInAcademy(academyId, dto.branchId);
    if (dto.branchId !== undefined && this.tenant.branchScope(auth)) {
      throw new ForbiddenException('Branch managers cannot move users between branches');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { ...dto, country: dto.country?.toUpperCase() },
      select: LIST_SELECT,
    });
    await this.access.invalidateUser(id);
    return flattenRoles(updated);
  }

  async changeStatus(academyId: string, auth: AuthContext, id: string, dto: ChangeStatusDto) {
    if (id === auth.userId) throw new BadRequestException('You cannot change your own account status');
    const user = await this.findInScope(academyId, auth, id);
    await this.assertNotProtected(auth, id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status, statusReason: dto.reason ?? null, statusChangedAt: new Date(), statusChangedById: auth.userId },
      select: LIST_SELECT,
    });
    await this.access.invalidateUser(id);
    if (dto.status !== UserStatus.ACTIVE) await this.tokens.revokeAllSessions(id, `status_${dto.status.toLowerCase()}`);
    if (user.email) {
      await this.mail.send({ to: user.email, template: 'account-status', data: { name: user.fullName, status: dto.status, reason: dto.reason } });
    }
    return flattenRoles(updated);
  }

  async assignRoles(academyId: string, auth: AuthContext, id: string, dto: AssignRolesDto) {
    await this.findInScope(academyId, auth, id);
    await this.assertNotProtected(auth, id);
    await this.assertAssignableRoles(auth, academyId, dto.roleIds);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({ data: dto.roleIds.map((roleId) => ({ userId: id, roleId })) }),
    ]);
    await this.access.invalidateUser(id);
    return this.get(academyId, auth, id);
  }

  /** Soft delete: anonymises PII, keeps referential history (classes, invoices). */
  async remove(academyId: string, auth: AuthContext, id: string) {
    if (id === auth.userId) throw new BadRequestException('You cannot delete your own account');
    await this.findInScope(academyId, auth, id);
    await this.assertNotProtected(auth, id);
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: UserStatus.INACTIVE,
        email: null,
        phone: null,
        passwordHash: null,
        twoFactorSecret: null,
        fullName: 'Deleted user',
      },
    });
    await this.tokens.revokeAllSessions(id, 'deleted');
    await this.access.invalidateUser(id);
    return { id };
  }

  async loginActivity(academyId: string, auth: AuthContext, id: string) {
    await this.findInScope(academyId, auth, id);
    return this.prisma.loginActivity.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async sessions(academyId: string, auth: AuthContext, id: string) {
    await this.findInScope(academyId, auth, id);
    return this.prisma.session.findMany({
      where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async revokeSessions(academyId: string, auth: AuthContext, id: string) {
    await this.findInScope(academyId, auth, id);
    const count = await this.tokens.revokeAllSessions(id, 'admin_revoked');
    return { revoked: count };
  }

  async auditTrail(academyId: string, auth: AuthContext, id: string) {
    await this.findInScope(academyId, auth, id);
    return this.prisma.auditLog.findMany({
      where: { OR: [{ actorId: id }, { entity: 'User', entityId: id }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateOwnProfile(userId: string, dto: UpdateOwnProfileDto) {
    await this.prisma.user.update({ where: { id: userId }, data: { ...dto, country: dto.country?.toUpperCase() } });
    await this.access.invalidateUser(userId);
    return this.authService.me(userId);
  }

  // ───── guards ─────

  private async findInScope(academyId: string, auth: AuthContext, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, academyId, deletedAt: null } });
    if (!user) throw new NotFoundException();
    this.assertBranch(auth, user.branchId);
    return user;
  }

  private assertBranch(auth: AuthContext, branchId: string | null) {
    const scope = this.tenant.branchScope(auth);
    if (scope && branchId !== scope) throw new NotFoundException();
  }

  private async assertBranchInAcademy(academyId: string, branchId: string) {
    const ok = await this.prisma.branch.count({ where: { id: branchId, academyId } });
    if (!ok) throw new BadRequestException('Branch does not belong to this academy');
  }

  /** Only a super admin may modify another super admin. */
  private async assertNotProtected(auth: AuthContext, targetId: string) {
    if (auth.isSuperAdmin) return;
    const isSuper = await this.prisma.userRole.count({ where: { userId: targetId, role: { slug: SystemRole.SUPER_ADMIN } } });
    if (isSuper) throw new ForbiddenException('Super Admin accounts can only be changed by a Super Admin');
  }

  /**
   * Prevents privilege escalation: a non-super-admin can only grant roles whose
   * permissions are a subset of their own, and never the super-admin role.
   */
  private async assertAssignableRoles(auth: AuthContext, academyId: string, roleIds: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, OR: [{ academyId: null }, { academyId }] },
      include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== new Set(roleIds).size) throw new BadRequestException('Unknown role');
    if (auth.isSuperAdmin) return;
    for (const role of roles) {
      if (role.slug === SystemRole.SUPER_ADMIN) throw new ForbiddenException('Only a Super Admin can grant Super Admin');
      const exceeds = role.permissions.some((rp) => !auth.permissions.has(rp.permission.key as never));
      if (exceeds) throw new ForbiddenException(`You cannot grant "${role.name}" — it has permissions you do not hold`);
    }
  }
}

function flattenRoles<T extends { roles: { role: { id: string; slug: string; name: string } }[] }>(u: T) {
  return { ...u, roles: u.roles.map((r) => r.role) };
}
