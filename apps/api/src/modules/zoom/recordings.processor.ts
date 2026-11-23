import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const RECORDINGS_QUEUE = 'recordings';

export interface RecordingImportJob {
  sessionName: string;
  externalId: string;
  downloadUrl: string;
  downloadToken?: string;
  sizeBytes?: number;
  recordingStart?: string;
  recordingEnd?: string;
}

/**
 * Copies a finished Zoom cloud recording into our private R2/S3 bucket
 * (streamed, multipart) so access is governed by our own permissions and
 * signed URLs — and so recordings survive Zoom's retention window.
 */
@Processor(RECORDINGS_QUEUE, { concurrency: 2 })
export class RecordingsProcessor extends WorkerHost {
  private readonly logger = new Logger(RecordingsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<RecordingImportJob>) {
    const d = job.data;
    const session = await this.prisma.classSession.findUnique({
      where: { zoomSessionName: d.sessionName },
      include: { course: { select: { title: true } }, attendees: { select: { studentId: true } } },
    });
    if (!session) {
      this.logger.warn(`Recording for unknown session ${d.sessionName}; skipping`);
      return;
    }

    const existing = await this.prisma.recording.findUnique({ where: { externalId: d.externalId } });
    if (existing?.status === 'AVAILABLE') return;

    const recordedAt = d.recordingStart ? new Date(d.recordingStart) : session.startsAt;
    const durationSeconds =
      d.recordingStart && d.recordingEnd
        ? Math.round((new Date(d.recordingEnd).getTime() - new Date(d.recordingStart).getTime()) / 1000)
        : null;
    const key = `recordings/${session.academyId}/${session.id}/${d.externalId}.mp4`;

    const recording =
      existing ??
      (await this.prisma.recording.create({
        data: {
          classSessionId: session.id,
          externalId: d.externalId,
          title: `${session.course.title} — ${session.title}`,
          recordedAt,
          durationSeconds,
          status: 'PROCESSING',
        },
      }));

    try {
      const url = d.downloadToken ? `${d.downloadUrl}?access_token=${encodeURIComponent(d.downloadToken)}` : d.downloadUrl;
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);

      const upload = new Upload({
        client: this.s3(),
        params: {
          Bucket: this.config.getOrThrow('STORAGE_BUCKET'),
          Key: key,
          Body: Readable.fromWeb(res.body as never),
          ContentType: 'video/mp4',
        },
        queueSize: 4,
        partSize: 16 * 1024 * 1024,
      });
      await upload.done();

      await this.prisma.recording.update({
        where: { id: recording.id },
        data: { status: 'AVAILABLE', storageKey: key, mimeType: 'video/mp4', sizeBytes: d.sizeBytes ? BigInt(d.sizeBytes) : null },
      });
      await this.notifications.notifyMany(
        session.attendees.map((a) => a.studentId),
        {
          type: 'recording.available',
          title: 'Class recording available',
          body: `The recording for "${session.title}" is ready to watch.`,
          data: { recordingId: recording.id, classSessionId: session.id },
        },
      );
    } catch (e) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.prisma.recording.update({ where: { id: recording.id }, data: { status: 'FAILED' } });
      }
      throw e;
    }
  }

  private client: S3Client | null = null;
  private s3() {
    this.client ??= new S3Client({
      region: this.config.get('STORAGE_REGION', 'auto'),
      endpoint: this.config.get('STORAGE_ENDPOINT') || undefined,
      credentials: {
        accessKeyId: this.config.getOrThrow('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow('STORAGE_SECRET_ACCESS_KEY'),
      },
    });
    return this.client;
  }
}
