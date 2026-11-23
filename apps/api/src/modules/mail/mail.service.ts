import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MailJob } from './mail.templates';

export const MAIL_QUEUE = 'mail';

/** Producers enqueue; MailProcessor delivers with retries. Requests never wait on SMTP. */
@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue<MailJob>) {}

  async send(job: MailJob) {
    await this.queue.add(job.template, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
