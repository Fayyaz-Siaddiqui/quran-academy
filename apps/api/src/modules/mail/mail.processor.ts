import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import nodemailer, { Transporter } from 'nodemailer';
import { MAIL_QUEUE } from './mail.service';
import { MailJob, renderMail } from './mail.templates';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    super();
    this.from = config.get<string>('MAIL_FROM')!;
    const host = config.get<string>('SMTP_HOST');
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: config.get<number>('SMTP_PORT'),
          secure: config.get<number>('SMTP_PORT') === 465,
          auth: config.get<string>('SMTP_USER')
            ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
            : undefined,
        })
      : null;
  }

  async process(job: Job<MailJob>) {
    const { subject, html } = renderMail(job.data);
    if (!this.transporter) {
      // Development fallback: no SMTP configured — log the email so links can be used locally.
      this.logger.warn(`[mail:dev] to=${job.data.to} subject="${subject}" data=${JSON.stringify(job.data.data)}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to: job.data.to, subject, html });
  }
}
