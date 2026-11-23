import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { Audit, CurrentAuth, RequirePermissions } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { CancelDto, ClassListQueryDto, EndClassDto, JoinClassDto, MarkAttendanceDto, RescheduleDto, ScheduleClassDto } from './classes.dto';
import { ClassesService } from './classes.service';

@ApiTags('Classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(
    private readonly classes: ClassesService,
    private readonly tenant: TenantService,
  ) {}

  /** Persona-aware: students/parents/teachers see their own; staff see the academy. */
  @Get()
  list(@CurrentAuth() a: AuthContext, @Query() q: ClassListQueryDto, @Req() req: Request) {
    const staffAcademy = a.academyId || a.isSuperAdmin ? this.safeAcademy(a, req) : undefined;
    return this.classes.list(a, q, staffAcademy);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASSES_MANAGE)
  @Audit({ action: 'class.schedule', entity: 'ClassSession' })
  schedule(@CurrentAuth() a: AuthContext, @Body() dto: ScheduleClassDto, @Req() req: Request) {
    return this.classes.schedule(this.tenant.academyId(a, req), a, dto);
  }

  @Get(':id')
  get(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.classes.get(a, id);
  }

  @Patch(':id/reschedule')
  @RequirePermissions(PERMISSIONS.CLASSES_MANAGE)
  @Audit({ action: 'class.reschedule', entity: 'ClassSession', idParam: 'id' })
  reschedule(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: RescheduleDto, @Req() req: Request) {
    return this.classes.reschedule(this.tenant.academyId(a, req), a, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.CLASSES_MANAGE)
  @Audit({ action: 'class.cancel', entity: 'ClassSession', idParam: 'id' })
  cancel(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: CancelDto, @Req() req: Request) {
    return this.classes.cancel(this.tenant.academyId(a, req), id, dto.reason);
  }

  /** Issues a Zoom Video SDK token for the caller (host for the teacher, participant otherwise). */
  @Post(':id/join')
  @HttpCode(200)
  join(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: JoinClassDto) {
    return this.classes.join(a, id, dto.studentId);
  }

  @Post(':id/start')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.CLASSES_TEACH)
  start(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.classes.start(a, id);
  }

  @Post(':id/end')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.CLASSES_TEACH)
  end(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: EndClassDto) {
    return this.classes.end(a, id, dto.teacherNotes);
  }

  @Patch(':id/notes')
  @RequirePermissions(PERMISSIONS.CLASSES_TEACH)
  notes(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: EndClassDto) {
    return this.classes.updateNotes(a, id, dto.teacherNotes ?? '');
  }

  @Patch(':id/attendance')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MARK)
  @Audit({ action: 'class.attendance', entity: 'ClassSession', idParam: 'id' })
  attendance(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: MarkAttendanceDto) {
    return this.classes.markAttendance(a, id, dto);
  }

  private safeAcademy(a: AuthContext, req: Request) {
    try {
      return this.tenant.academyId(a, req);
    } catch {
      return undefined;
    }
  }
}
