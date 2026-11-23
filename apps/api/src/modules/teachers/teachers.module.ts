import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { TeacherPortalService } from './teacher-portal.service';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  imports: [ClassesModule],
  controllers: [TeachersController],
  providers: [TeachersService, TeacherPortalService],
  exports: [TeachersService],
})
export class TeachersModule {}
