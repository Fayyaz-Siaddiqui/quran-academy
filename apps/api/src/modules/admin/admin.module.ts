import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ClassesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
