import { queueWorkers } from '../../common/utils/workers';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RecordingsProcessor, RECORDINGS_QUEUE } from '../zoom/recordings.processor';
import { ZoomWebhookController } from '../zoom/zoom-webhook.controller';
import { ZoomService } from '../zoom/zoom.service';
import { ClassSchedulerProcessor, CLASS_SCHEDULER_QUEUE } from './class-scheduler.processor';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  imports: [BullModule.registerQueue({ name: RECORDINGS_QUEUE }, { name: CLASS_SCHEDULER_QUEUE })],
  controllers: [ClassesController, ZoomWebhookController],
  providers: [ClassesService, ZoomService, ...queueWorkers(RecordingsProcessor, ClassSchedulerProcessor)],
  exports: [ClassesService],
})
export class ClassesModule {}
