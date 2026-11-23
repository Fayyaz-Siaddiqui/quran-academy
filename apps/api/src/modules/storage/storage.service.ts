import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UPLOADS } from '@qa/config';
import { randomUUID } from 'crypto';

/**
 * Private object storage on Cloudflare R2 (S3-compatible) or AWS S3.
 * The bucket is never public: clients upload and download through
 * short-lived presigned URLs issued after an authorization check.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('STORAGE_BUCKET', '');
    const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY_ID');
    this.client =
      this.bucket && accessKeyId
        ? new S3Client({
            region: config.get<string>('STORAGE_REGION', 'auto'),
            endpoint: config.get<string>('STORAGE_ENDPOINT') || undefined,
            credentials: { accessKeyId, secretAccessKey: config.get<string>('STORAGE_SECRET_ACCESS_KEY', '') },
          })
        : null;
  }

  get enabled() {
    return this.client !== null;
  }

  private get s3(): S3Client {
    if (!this.client) throw new ServiceUnavailableException('File storage is not configured');
    return this.client;
  }

  /** Keys are namespaced and unguessable; the original filename is stored in the DB only. */
  buildKey(prefix: string, ownerId: string, fileName: string) {
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
    return `${prefix}/${ownerId}/${randomUUID()}.${ext}`;
  }

  async presignUpload(key: string, contentType: string, contentLength: number) {
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
      { expiresIn: UPLOADS.SIGNED_URL_TTL_SECONDS },
    );
    return { url, key, expiresIn: UPLOADS.SIGNED_URL_TTL_SECONDS };
  }

  async presignDownload(key: string, downloadName?: string) {
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: downloadName ? `inline; filename="${downloadName.replace(/"/g, '')}"` : undefined,
      }),
      { expiresIn: UPLOADS.SIGNED_URL_TTL_SECONDS },
    );
    return { url, expiresIn: UPLOADS.SIGNED_URL_TTL_SECONDS };
  }

  async putObject(key: string, body: Buffer | Uint8Array | NodeJS.ReadableStream, contentType: string, length?: number) {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body as never, ContentType: contentType, ContentLength: length }),
    );
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
