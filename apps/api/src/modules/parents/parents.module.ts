import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentsModule } from '../students/students.module';
import { ClassesModule } from '../classes/classes.module';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
  imports: [AuthModule, StudentsModule, ClassesModule],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
