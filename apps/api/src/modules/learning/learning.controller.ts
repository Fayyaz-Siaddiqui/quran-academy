import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { HomeworkStatus } from '@prisma/client';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { Audit, CurrentAuth, RequirePermissions } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../access/tenant.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SOCKET_EVENTS } from '@qa/config';
import { AssignHomeworkDto, RecordProgressDto, ReviewHomeworkDto, SubmitHomeworkDto } from './learning.dto';
import { LearningService } from './learning.service';

class HomeworkQueryDto {
  @ApiPropertyOptional({ enum: HomeworkStatus }) @IsOptional() @IsEnum(HomeworkStatus) status?: HomeworkStatus;
}

class AnnouncementDto {
  @ApiProperty() @IsString() @Length(2, 200) title: string;
  @ApiProperty() @IsString() @Length(2, 10000) body: string;
  @ApiPropertyOptional({ type: [String], description: 'Role slugs; empty = everyone' }) @IsOptional() @IsArray() @IsString({ each: true }) audience?: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() publishedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}

/**
 * Student-scoped resources use `/students/:studentId/...` so the same endpoints
 * serve the student (studentId = "me"), their parents, teachers and staff.
 * Access is decided per request by LearningService.assertCanViewStudent.
 */
@ApiTags('Learning')
@ApiBearerAuth()
@Controller()
export class LearningController {
  constructor(
    private readonly learning: LearningService,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly gateway: NotificationsGateway,
  ) {}

  private sid(a: AuthContext, studentId: string) {
    return studentId === 'me' ? a.userId : studentId;
  }

  // ───── Homework ─────

  @Get('students/:studentId/homework')
  homework(@CurrentAuth() a: AuthContext, @Param('studentId') id: string, @Query() q: HomeworkQueryDto) {
    return this.learning.listHomework(a, this.sid(a, id), q.status);
  }

  @Post('homework')
  @RequirePermissions(PERMISSIONS.HOMEWORK_ASSIGN)
  assign(@CurrentAuth() a: AuthContext, @Body() dto: AssignHomeworkDto) {
    return this.learning.assignHomework(a, dto);
  }

  @Get('homework/teaching')
  @RequirePermissions(PERMISSIONS.HOMEWORK_REVIEW)
  teaching(@CurrentAuth() a: AuthContext, @Query() q: HomeworkQueryDto) {
    return this.learning.teacherHomework(a.userId, q.status);
  }

  @Post('homework/:id/submit')
  submit(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: SubmitHomeworkDto) {
    return this.learning.submitHomework(a, id, dto);
  }

  @Patch('homework/:id/review')
  @RequirePermissions(PERMISSIONS.HOMEWORK_REVIEW)
  review(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: ReviewHomeworkDto) {
    return this.learning.reviewHomework(a, id, dto);
  }

  @Get('homework/submissions/:id/attachment')
  attachment(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.learning.submissionAttachmentUrl(a, id);
  }

  // ───── Progress ─────

  @Get('students/:studentId/progress')
  progress(@CurrentAuth() a: AuthContext, @Param('studentId') id: string) {
    return this.learning.listProgress(a, this.sid(a, id));
  }

  @Post('progress')
  @RequirePermissions(PERMISSIONS.PROGRESS_RECORD)
  recordProgress(@CurrentAuth() a: AuthContext, @Body() dto: RecordProgressDto) {
    return this.learning.recordProgress(a, dto);
  }

  // ───── Recordings ─────

  @Get('students/:studentId/recordings')
  recordings(@CurrentAuth() a: AuthContext, @Param('studentId') id: string) {
    return this.learning.listRecordings(a, this.sid(a, id));
  }

  @Get('recordings/:id/url')
  recordingUrl(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.learning.recordingUrl(a, id);
  }

  // ───── Announcements ─────

  @Get('announcements/feed')
  feed(@CurrentAuth() a: AuthContext) {
    return this.learning.announcementsFor(a);
  }

  @Get('announcements')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  announcements(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.prisma.announcement.findMany({ where: { academyId: this.tenant.academyId(a, req) }, orderBy: { publishedAt: 'desc' }, take: 100 });
  }

  @Post('announcements')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @Audit({ action: 'announcement.create', entity: 'Announcement' })
  async createAnnouncement(@CurrentAuth() a: AuthContext, @Body() dto: AnnouncementDto, @Req() req: Request) {
    const academyId = this.tenant.academyId(a, req);
    const ann = await this.prisma.announcement.create({
      data: {
        academyId,
        title: dto.title,
        body: dto.body,
        audience: dto.audience ?? [],
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: a.userId,
      },
    });
    if (ann.publishedAt <= new Date()) this.gateway.toAcademy(academyId, SOCKET_EVENTS.ANNOUNCEMENT_NEW, ann);
    return ann;
  }

  @Delete('announcements/:id')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @Audit({ action: 'announcement.delete', entity: 'Announcement', idParam: 'id' })
  async deleteAnnouncement(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    const { count } = await this.prisma.announcement.deleteMany({ where: { id, academyId: this.tenant.academyId(a, req) } });
    if (!count) throw new NotFoundException();
    return { id };
  }
}
