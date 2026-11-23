import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { Audit, CurrentAuth, RequirePermissions } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { AssignRolesDto, ChangeStatusDto, CreateUserDto, UpdateOwnProfileDto, UpdateUserDto, UserListQueryDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly tenant: TenantService,
  ) {}

  @Patch('me')
  updateMe(@CurrentAuth() a: AuthContext, @Body() dto: UpdateOwnProfileDto) {
    return this.users.updateOwnProfile(a.userId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list(@CurrentAuth() a: AuthContext, @Query() q: UserListQueryDto, @Req() req: Request) {
    return this.users.list(this.tenant.academyId(a, req), a, q);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @Audit({ action: 'user.create', entity: 'User' })
  create(@CurrentAuth() a: AuthContext, @Body() dto: CreateUserDto, @Req() req: Request) {
    return this.users.create(this.tenant.academyId(a, req), a, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  get(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.users.get(this.tenant.academyId(a, req), a, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  @Audit({ action: 'user.update', entity: 'User', idParam: 'id' })
  update(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    return this.users.update(this.tenant.academyId(a, req), a, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.USERS_SUSPEND)
  @Audit({ action: 'user.status_change', entity: 'User', idParam: 'id' })
  changeStatus(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: ChangeStatusDto, @Req() req: Request) {
    return this.users.changeStatus(this.tenant.academyId(a, req), a, id, dto);
  }

  @Patch(':id/roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_UPDATE)
  @Audit({ action: 'user.roles_assign', entity: 'User', idParam: 'id' })
  assignRoles(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: AssignRolesDto, @Req() req: Request) {
    return this.users.assignRoles(this.tenant.academyId(a, req), a, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @Audit({ action: 'user.delete', entity: 'User', idParam: 'id' })
  remove(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.users.remove(this.tenant.academyId(a, req), a, id);
  }

  @Get(':id/login-activity')
  @RequirePermissions(PERMISSIONS.USERS_ACTIVITY)
  loginActivity(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.users.loginActivity(this.tenant.academyId(a, req), a, id);
  }

  @Get(':id/activity')
  @RequirePermissions(PERMISSIONS.USERS_ACTIVITY)
  activity(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.users.auditTrail(this.tenant.academyId(a, req), a, id);
  }

  @Get(':id/sessions')
  @RequirePermissions(PERMISSIONS.USERS_ACTIVITY)
  sessions(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.users.sessions(this.tenant.academyId(a, req), a, id);
  }

  @Delete(':id/sessions')
  @RequirePermissions(PERMISSIONS.USERS_SUSPEND)
  @Audit({ action: 'user.sessions_revoke', entity: 'User', idParam: 'id' })
  revokeSessions(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.users.revokeSessions(this.tenant.academyId(a, req), a, id);
  }
}
