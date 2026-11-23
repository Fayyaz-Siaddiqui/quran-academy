import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { CurrentAuth, RequirePermissions } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { AuditService } from './audit.service';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() actorId?: string;
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  list(@CurrentAuth() auth: AuthContext, @Query() q: AuditQueryDto, @Req() req: Request) {
    return this.audit.list(this.tenant.academyId(auth, req), q);
  }
}
