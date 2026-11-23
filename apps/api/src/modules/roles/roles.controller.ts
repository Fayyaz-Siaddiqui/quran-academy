import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { Audit, CurrentAuth, RequirePermissions } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { CreateRoleDto, RolesService, UpdateRoleDto } from './roles.service';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly tenant: TenantService,
  ) {}

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  permissions() {
    return this.roles.permissions();
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  list(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.roles.list(this.tenant.academyId(a, req));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Audit({ action: 'role.create', entity: 'Role' })
  create(@CurrentAuth() a: AuthContext, @Body() dto: CreateRoleDto, @Req() req: Request) {
    return this.roles.create(this.tenant.academyId(a, req), a, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Audit({ action: 'role.update', entity: 'Role', idParam: 'id' })
  update(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: Request) {
    return this.roles.update(this.tenant.academyId(a, req), a, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Audit({ action: 'role.delete', entity: 'Role', idParam: 'id' })
  remove(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.roles.remove(this.tenant.academyId(a, req), id);
  }
}
