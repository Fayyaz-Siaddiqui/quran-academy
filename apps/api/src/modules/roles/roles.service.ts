import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PermissionKey, SystemRole } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { AccessService } from '../access/access.service';

export class CreateRoleDto {
  @ApiProperty() @IsString() @Length(2, 60) name: string;
  @ApiProperty({ example: 'quality-reviewer' }) @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @Length(2, 60) slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) permissions: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
}

/**
 * Roles are either platform system roles (academyId = null, isSystem = true)
 * or custom roles owned by one academy. System roles' permission sets may be
 * tuned by a Super Admin only; they can never be deleted or renamed.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  permissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
  }

  async list(academyId: string) {
    const roles = await this.prisma.role.findMany({
      where: { OR: [{ academyId: null }, { academyId }] },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: { where: { user: { academyId } } } } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map(({ permissions, _count, ...r }) => ({
      ...r,
      permissions: permissions.map((p) => p.permission.key),
      userCount: _count.users,
    }));
  }

  async create(academyId: string, auth: AuthContext, dto: CreateRoleDto) {
    if (Object.values(SystemRole).includes(dto.slug as never)) throw new ConflictException('This slug is reserved');
    const permIds = await this.resolvePermissions(auth, dto.permissions);
    const role = await this.prisma.role.create({
      data: {
        academyId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        permissions: { create: permIds.map((permissionId) => ({ permissionId })) },
      },
    });
    return role;
  }

  async update(academyId: string, auth: AuthContext, id: string, dto: UpdateRoleDto) {
    const role = await this.findVisible(academyId, id);
    if (role.isSystem && !auth.isSuperAdmin) throw new ForbiddenException('System roles can only be changed by a Super Admin');
    if (role.slug === SystemRole.SUPER_ADMIN && dto.permissions) {
      throw new ForbiddenException('Super Admin always holds every permission');
    }
    if (role.isSystem && dto.name) throw new BadRequestException('System roles cannot be renamed');

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { name: dto.name, description: dto.description } });
      if (dto.permissions) {
        const permIds = await this.resolvePermissions(auth, dto.permissions);
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: permIds.map((permissionId) => ({ roleId: id, permissionId })) });
      }
    });
    await this.access.invalidateRole(id);
    return (await this.list(academyId)).find((r) => r.id === id);
  }

  /** Delete is only "safe" for custom roles that no user currently holds. */
  async remove(academyId: string, id: string) {
    const role = await this.findVisible(academyId, id);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');
    if (role.academyId !== academyId) throw new NotFoundException();
    const holders = await this.prisma.userRole.count({ where: { roleId: id } });
    if (holders) throw new ConflictException(`Role is assigned to ${holders} user(s). Reassign them first.`);
    await this.prisma.role.delete({ where: { id } });
    return { id };
  }

  private async findVisible(academyId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, OR: [{ academyId: null }, { academyId }] } });
    if (!role) throw new NotFoundException();
    return role;
  }

  /** Callers may only grant permissions they themselves hold. */
  private async resolvePermissions(auth: AuthContext, keys: string[]) {
    const unique = [...new Set(keys)];
    const perms = await this.prisma.permission.findMany({ where: { key: { in: unique } }, select: { id: true, key: true } });
    if (perms.length !== unique.length) throw new BadRequestException('Unknown permission in list');
    if (!auth.isSuperAdmin) {
      const notHeld = perms.filter((p) => !auth.permissions.has(p.key as PermissionKey));
      if (notHeld.length) throw new ForbiddenException(`You cannot grant: ${notHeld.map((p) => p.key).join(', ')}`);
    }
    return perms.map((p) => p.id);
  }
}
