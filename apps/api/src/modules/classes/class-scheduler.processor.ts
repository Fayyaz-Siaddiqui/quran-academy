import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassesService } from './classes.service';

export const CLASS_SCHEDULER_QUEUE = 'class-scheduler';

/**
 * Repeatable maintenance jobs (BullMQ job schedulers survive restarts and run
 * once across all API instances):
 *  - every minute: send "class starts in 15 minutes" reminders
 *  - every 5 minutes: mark missed classes, auto-complete abandoned live classes
 */
@Processor(CLASS_SCHEDULER_QUEUE)
export class ClassSchedulerProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClassSchedulerProcessor.name);

  constructor(
    @InjectQueue(CLASS_SCHEDULER_QUEUE) private readonly queue: Queue,
    private readonly classes: ClassesService,
    private readonly notifications: NotificationsService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    await this.queue.upsertJobScheduler('reminders', { every: 60_000 }, { name: 'reminders' });
    await this.queue.upsertJobScheduler('maintenance', { every: 5 * 60_000 }, { name: 'maintenance' });
  }

  async process(job: Job) {
    if (job.name === 'maintenance') {
      const result = await this.classes.markMissedClasses();
      if (result.missed || result.autoCompleted) this.logger.log(`Class maintenance: ${JSON.stringify(result)}`);
      return result;
    }
    if (job.name === 'reminders') {
      const now = Date.now();
      const due = await this.classes.upcomingForReminder(new Date(now + 14 * 60_000), new Date(now + 16 * 60_000));
      for (const cls of due) {
        // SET NX makes the reminder idempotent even though windows overlap.
        const first = await this.redis.set(`reminder:${cls.id}`, '1', 'EX', 3600, 'NX');
        if (!first) continue;
        await this.notifications.notifyMany([cls.teacherId, ...cls.attendees.map((a) => a.studentId)], {
          type: 'class.reminder',
          title: 'Class starts in 15 minutes',
          body: `${cls.course.title}: ${cls.title}`,
          data: { classSessionId: cls.id },
        });
      }
      return { reminded: due.length };
    }
  }
}
