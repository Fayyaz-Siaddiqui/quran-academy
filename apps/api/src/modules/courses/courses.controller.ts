import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, SystemRole } from '@qa/shared-types';
import type { Request } from 'express';
import { Audit, CurrentAuth, Public, RequirePermissions, RequireRoles } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { CreateCourseDto, EnrollDto, LessonDto, UpdateCourseDto, UpdateEnrollmentDto } from './courses.dto';
import { CoursesService } from './courses.service';

@ApiTags('Courses')
@Controller()
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly tenant: TenantService,
  ) {}

  // ───── Public ─────

  @Public()
  @Get('public/courses')
  async publicList(@Req() req: Request) {
    return this.courses.publicList(await this.tenant.publicAcademyId(req));
  }

  @Public()
  @Get('public/courses/:slug')
  async publicGet(@Param('slug') slug: string, @Req() req: Request) {
    return this.courses.publicGet(await this.tenant.publicAcademyId(req), slug);
  }

  // ───── Student ─────

  @ApiBearerAuth()
  @RequireRoles(SystemRole.STUDENT)
  @Get('me/courses')
  myCourses(@CurrentAuth() a: AuthContext) {
    return this.courses.studentCourses(a.userId);
  }

  @ApiBearerAuth()
  @RequireRoles(SystemRole.STUDENT)
  @Get('me/lessons/:lessonId')
  lesson(@CurrentAuth() a: AuthContext, @Param('lessonId') id: string) {
    return this.courses.lesson(a, id);
  }

  @ApiBearerAuth()
  @RequireRoles(SystemRole.STUDENT)
  @HttpCode(200)
  @Post('me/lessons/:lessonId/complete')
  complete(@CurrentAuth() a: AuthContext, @Param('lessonId') id: string) {
    return this.courses.completeLesson(a.userId, id);
  }

  // ───── Admin ─────

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_READ)
  @Get('courses')
  list(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.courses.adminList(this.tenant.academyId(a, req));
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_READ)
  @Get('courses/:id')
  get(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.courses.adminGet(this.tenant.academyId(a, req), id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @Audit({ action: 'course.create', entity: 'Course' })
  @Post('courses')
  create(@CurrentAuth() a: AuthContext, @Body() dto: CreateCourseDto, @Req() req: Request) {
    return this.courses.create(this.tenant.academyId(a, req), dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @Audit({ action: 'course.update', entity: 'Course', idParam: 'id' })
  @Patch('courses/:id')
  update(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateCourseDto, @Req() req: Request) {
    return this.courses.update(this.tenant.academyId(a, req), id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @Audit({ action: 'course.delete', entity: 'Course', idParam: 'id' })
  @Delete('courses/:id')
  remove(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.courses.remove(this.tenant.academyId(a, req), id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @Post('courses/:id/lessons')
  addLesson(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: LessonDto, @Req() req: Request) {
    return this.courses.upsertLesson(this.tenant.academyId(a, req), id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @Patch('courses/:id/lessons/:lessonId')
  updateLesson(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Param('lessonId') lessonId: string, @Body() dto: LessonDto, @Req() req: Request) {
    return this.courses.upsertLesson(this.tenant.academyId(a, req), id, dto, lessonId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  @Delete('courses/:id/lessons/:lessonId')
  removeLesson(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Param('lessonId') lessonId: string, @Req() req: Request) {
    return this.courses.removeLesson(this.tenant.academyId(a, req), id, lessonId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_MANAGE)
  @Audit({ action: 'enrollment.create', entity: 'Enrollment' })
  @Post('enrollments')
  enroll(@CurrentAuth() a: AuthContext, @Body() dto: EnrollDto, @Req() req: Request) {
    return this.courses.enroll(this.tenant.academyId(a, req), dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_MANAGE)
  @Audit({ action: 'enrollment.update', entity: 'Enrollment', idParam: 'id' })
  @Patch('enrollments/:id')
  updateEnrollment(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateEnrollmentDto, @Req() req: Request) {
    return this.courses.updateEnrollment(this.tenant.academyId(a, req), id, dto);
  }
}
