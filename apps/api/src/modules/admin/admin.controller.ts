import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { CurrentAuth, RequirePermissions } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthContext } from '../../common/types/auth-context';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../access/tenant.service';
import { AdminService } from './admin.service';

class EnrollmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EnrollmentStatus }) @IsOptional() @IsEnum(EnrollmentStatus) status?: EnrollmentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teacherId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() courseId?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller()
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly tenant: TenantService,
    private readonly prisma: PrismaService,
  ) {}

  private scope(a: AuthContext, req: Request) {
    return { academyId: this.tenant.academyId(a, req), branchId: this.tenant.branchScope(a) };
  }

  /** Academy (or branch) KPIs and action items, computed in the viewer's time zone. */
  @Get('admin/overview')
  @RequirePermissions(PERMISSIONS.STUDENTS_READ, PERMISSIONS.CLASSES_READ)
  async overview(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: a.userId }, select: { timezone: true } });
    return this.admin.overview(this.scope(a, req), a.userId, me.timezone);
  }

  @Get('enrollments')
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  enrollments(@CurrentAuth() a: AuthContext, @Query() q: EnrollmentQueryDto, @Req() req: Request) {
    return this.admin.enrollments(this.scope(a, req), q);
  }

  @Get('enrollments/awaiting')
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  awaiting(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.admin.studentsAwaitingEnrollment(this.scope(a, req));
  }
}
