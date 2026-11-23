import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, IsTimeZone, Length, Matches } from 'class-validator';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Audit, CurrentAuth, RequirePermissions } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';

class CreateAcademyDto {
  @ApiProperty() @IsString() @Length(2, 120) name: string;
  @ApiProperty() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @Length(2, 60) slug: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() settings?: Record<string, unknown>;
}

class UpdateAcademyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() settings?: Record<string, unknown>;
}

class BranchDto {
  @ApiProperty() @IsString() @Length(2, 120) name: string;
  @ApiProperty() @Matches(/^[A-Z0-9-]{2,20}$/) code: string;
  @ApiProperty() @IsTimeZone() timezone: string;
}

class UpdateBranchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsTimeZone() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('Tenancy')
@ApiBearerAuth()
@Controller()
export class TenancyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Academies are platform-level: Super Admin only (academies.manage is not granted to academy admins).
  @Get('academies')
  @RequirePermissions(PERMISSIONS.ACADEMIES_MANAGE)
  academies() {
    return this.prisma.academy.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { users: true, branches: true } } } });
  }

  @Post('academies')
  @RequirePermissions(PERMISSIONS.ACADEMIES_MANAGE)
  @Audit({ action: 'academy.create', entity: 'Academy' })
  createAcademy(@Body() dto: CreateAcademyDto) {
    return this.prisma.academy.create({ data: { name: dto.name, slug: dto.slug, settings: (dto.settings ?? {}) as never } });
  }

  @Patch('academies/:id')
  @RequirePermissions(PERMISSIONS.ACADEMIES_MANAGE)
  @Audit({ action: 'academy.update', entity: 'Academy', idParam: 'id' })
  updateAcademy(@Param('id') id: string, @Body() dto: UpdateAcademyDto) {
    return this.prisma.academy.update({ where: { id }, data: { ...dto, settings: dto.settings as never } });
  }

  @Get('branches')
  @RequirePermissions(PERMISSIONS.BRANCHES_READ)
  branches(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    const academyId = this.tenant.academyId(a, req);
    const scope = this.tenant.branchScope(a);
    return this.prisma.branch.findMany({ where: { academyId, ...(scope ? { id: scope } : {}) }, orderBy: { name: 'asc' } });
  }

  @Post('branches')
  @RequirePermissions(PERMISSIONS.BRANCHES_MANAGE)
  @Audit({ action: 'branch.create', entity: 'Branch' })
  createBranch(@CurrentAuth() a: AuthContext, @Body() dto: BranchDto, @Req() req: Request) {
    return this.prisma.branch.create({ data: { ...dto, academyId: this.tenant.academyId(a, req) } });
  }

  @Patch('branches/:id')
  @RequirePermissions(PERMISSIONS.BRANCHES_MANAGE)
  @Audit({ action: 'branch.update', entity: 'Branch', idParam: 'id' })
  async updateBranch(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateBranchDto, @Req() req: Request) {
    const academyId = this.tenant.academyId(a, req);
    const { count } = await this.prisma.branch.updateMany({ where: { id, academyId }, data: dto });
    if (!count) throw new NotFoundException();
    return this.prisma.branch.findUnique({ where: { id } });
  }
}
