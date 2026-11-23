import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@qa/shared-types';
import { CurrentAuth, RequireRoles } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { LearningService } from '../learning/learning.service';
import { StudentsService } from './students.service';

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly learning: LearningService,
  ) {}

  @RequireRoles(SystemRole.STUDENT)
  @Get('me/dashboard')
  dashboard(@CurrentAuth() a: AuthContext) {
    return this.students.dashboard(a.userId);
  }

  @RequireRoles(SystemRole.STUDENT)
  @Get('me/profile')
  myProfile(@CurrentAuth() a: AuthContext) {
    return this.students.profile(a.userId);
  }

  /** Staff, teachers and parents (access decided by LearningService). */
  @Get(':id/profile')
  async profile(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    await this.learning.assertCanViewStudent(a, id);
    return this.students.profile(id);
  }
}
