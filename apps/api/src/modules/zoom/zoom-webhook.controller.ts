import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Body, Controller, HttpCode, Logger, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { Public } from '../../common/decorators';
import { ClassesService } from '../classes/classes.service';
import { RECORDINGS_QUEUE, RecordingImportJob } from './recordings.processor';
import { ZoomService } from './zoom.service';

interface ZoomEvent {
  event: string;
  event_ts: number;
  download_token?: string;
  payload: {
    plainToken?: string;
    object?: {
      session_id?: string;
      session_name?: string;
      participant?: { user_key?: string; user_name?: string; join_time?: string; leave_time?: string };
      recording_files?: {
        id: string;
        file_type: string;
        file_extension?: string;
        file_size?: number;
        download_url: string;
        recording_start?: string;
        recording_end?: string;
        status?: string;
      }[];
    };
  };
}

@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('webhooks/zoom')
export class ZoomWebhookController {
  private readonly logger = new Logger(ZoomWebhookController.name);

  constructor(
    private readonly zoom: ZoomService,
    private readonly classes: ClassesService,
    @InjectQueue(RECORDINGS_QUEUE) private readonly recordings: Queue<RecordingImportJob>,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<Request>, @Body() body: ZoomEvent) {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new BadRequestException();
    if (!this.zoom.verifyWebhook(raw, req.header('x-zm-request-timestamp'), req.header('x-zm-signature'))) {
      throw new UnauthorizedException('Invalid signature');
    }

    if (body.event === 'endpoint.url_validation' && body.payload.plainToken) {
      return this.zoom.urlValidation(body.payload.plainToken);
    }

    const obj = body.payload.object;
    const sessionName = obj?.session_name;
    if (!sessionName) return { ok: true };

    switch (body.event) {
      case 'session.started':
        await this.classes.markLiveFromProvider(sessionName, obj?.session_id);
        break;
      case 'session.ended':
        await this.classes.markEndedFromProvider(sessionName);
        break;
      case 'session.user_joined':
        if (obj?.participant?.user_key) await this.classes.recordJoin(sessionName, obj.participant.user_key, obj.participant.join_time);
        break;
      case 'session.user_left':
        if (obj?.participant?.user_key) await this.classes.recordLeave(sessionName, obj.participant.user_key, obj.participant.leave_time);
        break;
      case 'session.recording_completed':
        for (const file of obj?.recording_files ?? []) {
          if (file.file_type?.toUpperCase() !== 'MP4') continue;
          await this.recordings.add(
            'import',
            {
              sessionName,
              externalId: file.id,
              downloadUrl: file.download_url,
              downloadToken: body.download_token,
              sizeBytes: file.file_size,
              recordingStart: file.recording_start,
              recordingEnd: file.recording_end,
            },
            { jobId: `rec-${file.id}`, attempts: 5, backoff: { type: 'exponential', delay: 60_000 }, removeOnComplete: 500 },
          );
        }
        break;
      default:
        this.logger.debug(`Ignoring Zoom event ${body.event}`);
    }
    return { ok: true };
  }
}
