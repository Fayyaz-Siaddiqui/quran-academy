import { Body, Controller, Get, Param, Patch, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { TeacherApprovalStatus } from '@prisma/client';
import { PERMISSIONS, SystemRole } from '@qa/shared-types';
import type { Request } from 'express';
import { Audit, CurrentAuth, Public, RequirePermissions, RequireRoles } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthContext } from '../../common/types/auth-context';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../access/tenant.service';
import { AvailabilitySlotDto } from '../auth/dto/auth.dto';
import { TeacherPortalService } from './teacher-portal.service';
import { TeachersService } from './teachers.service';

class ApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TeacherApprovalStatus }) @IsOptional() @IsEnum(TeacherApprovalStatus) status?: TeacherApprovalStatus;
}

class ReviewDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class PublishDto {
  @ApiProperty() @IsBoolean() isPublic: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
}

class AvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}

class UpdateTeacherProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) certifications?: string[];
}

@ApiTags('Teachers')
@Controller('teachers')
export class TeachersController {
  constructor(
    private readonly teachers: TeachersService,
    private readonly portal: TeacherPortalService,
    private readonly tenant: TenantService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('public')
  async publicList(@Req() req: Request) {
    return this.teachers.publicList(await this.tenant.publicAcademyId(req));
  }

  // ───── Teacher self-service ─────

  @ApiBearerAuth()
  @RequireRoles(SystemRole.TEACHER)
  @Get('me')
  me(@CurrentAuth() a: AuthContext) {
    return this.teachers.myProfile(a.userId);
  }

  @ApiBearerAuth()
  @RequireRoles(SystemRole.TEACHER)
  @Get('me/dashboard')
  dashboard(@CurrentAuth() a: AuthContext) {
    return this.portal.dashboard(a.userId);
  }

  @ApiBearerAuth()
  @RequireRoles(SystemRole.TEACHER)
  @Get('me/students')
  students(@CurrentAuth() a: AuthContext) {
    return this.portal.students(a.userId);
  }

  @ApiBearerAuth()
  @RequireRoles(SystemRole.TEACHER)
  @Get('me/students/:studentId/courses')
  studentCourses(@CurrentAuth() a: AuthContext, @Param('studentId') studentId: string) {
    return this.portal.studentCourses(a.userId, studentId);
  }

  @ApiBearerAuth()
  @RequireRoles(SystemRole.TEACHER)
  @Patch('me')
  updateMe(@CurrentAuth() a: AuthContext, @Body() dto: UpdateTeacherProfileDto) {
    return this.teachers.updateMyProfile(a.userId, dto);
  }

  @ApiBearerAuth()
  @RequireRoles(SystemRole.TEACHER)
  @Put('me/availability')
  async availability(@CurrentAuth() a: AuthContext, @Body() dto: AvailabilityDto) {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({ where: { id: a.userId }, select: { timezone: true } });
    return this.teachers.replaceAvailability(a.userId, timezone, dto.slots);
  }

  // ───── Administration ─────

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TEACHERS_READ)
  @Get('applications')
  applications(@CurrentAuth() a: AuthContext, @Query() q: ApplicationsQueryDto, @Req() req: Request) {
    return this.teachers.applications(this.tenant.academyId(a, req), q);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TEACHERS_APPROVE)
  @Patch(':id/review')
  review(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: ReviewDto, @Req() req: Request) {
    return this.teachers.review(this.tenant.academyId(a, req), a, id, dto.decision, dto.notes);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  @Audit({ action: 'teacher.publish', entity: 'User', idParam: 'id' })
  @Patch(':id/publish')
  publish(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: PublishDto, @Req() req: Request) {
    return this.teachers.setPublic(this.tenant.academyId(a, req), id, dto.isPublic, dto.specialties);
  }
}
