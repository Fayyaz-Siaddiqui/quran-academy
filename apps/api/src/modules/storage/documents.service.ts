import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { UPLOADS } from '@qa/config';
import { PERMISSIONS } from '@qa/shared-types';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import type { AuthContext } from '../../common/types/auth-context';
import { StorageService } from './storage.service';

const PENDING_UPLOAD_TTL = UPLOADS.SIGNED_URL_TTL_SECONDS + 300;
const pendingKey = (key: string) => `upload:${key}`;

const PREFIX: Record<DocumentType, string> = {
  TEACHER_CERTIFICATE: 'teachers/certificates',
  TEACHER_ID: 'teachers/id',
  TEACHER_CV: 'teachers/cv',
  STUDENT_DOCUMENT: 'students/documents',
  COURSE_MATERIAL: 'courses/materials',
  HOMEWORK_ATTACHMENT: 'homework',
  AVATAR: 'avatars',
  OTHER: 'other',
};

interface PendingUpload {
  ownerId: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Two-step private upload:
 *  1. requestUpload → validates type/size, returns a presigned PUT URL
 *  2. client uploads directly to R2/S3
 *  3. confirmUpload → records the Document row (only for keys we issued)
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async requestUpload(ownerId: string, type: DocumentType, fileName: string, mimeType: string, sizeBytes: number) {
    const isAvatar = type === DocumentType.AVATAR;
    const allowed: readonly string[] = isAvatar ? UPLOADS.ALLOWED_AVATAR_MIME : UPLOADS.ALLOWED_DOCUMENT_MIME;
    const max = isAvatar ? UPLOADS.MAX_AVATAR_BYTES : UPLOADS.MAX_DOCUMENT_BYTES;
    if (!allowed.includes(mimeType)) throw new BadRequestException(`File type ${mimeType} is not allowed`);
    if (sizeBytes <= 0 || sizeBytes > max) throw new BadRequestException(`File must be smaller than ${Math.round(max / 1048576)} MB`);

    const key = this.storage.buildKey(PREFIX[type], ownerId, fileName);
    const pending: PendingUpload = { ownerId, type, fileName: fileName.slice(0, 200), mimeType, sizeBytes };
    await this.redis.set(pendingKey(key), JSON.stringify(pending), 'EX', PENDING_UPLOAD_TTL);
    return this.storage.presignUpload(key, mimeType, sizeBytes);
  }

  async confirmUpload(ownerId: string, key: string) {
    const raw = await this.redis.get(pendingKey(key));
    if (!raw) throw new BadRequestException('Upload expired or unknown');
    const pending = JSON.parse(raw) as PendingUpload;
    if (pending.ownerId !== ownerId) throw new ForbiddenException();
    await this.redis.del(pendingKey(key));

    const doc = await this.prisma.document.create({
      data: { ownerId, type: pending.type, storageKey: key, fileName: pending.fileName, mimeType: pending.mimeType, sizeBytes: pending.sizeBytes },
    });
    if (pending.type === DocumentType.AVATAR) {
      await this.prisma.user.update({ where: { id: ownerId }, data: { avatarKey: key } });
    }
    return doc;
  }

  async listOwn(ownerId: string) {
    return this.prisma.document.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
  }

  /** Owner, the owner's parent, or staff with read rights for that owner type may download. */
  async downloadUrl(auth: AuthContext, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { owner: { select: { academyId: true, teacherProfile: { select: { userId: true } } } } },
    });
    if (!doc) throw new NotFoundException();

    const isOwner = doc.ownerId === auth.userId;
    const isParent =
      !isOwner &&
      (await this.prisma.parentChild.count({ where: { parentId: auth.userId, childId: doc.ownerId } })) > 0;
    const sameAcademy = auth.isSuperAdmin || doc.owner.academyId === auth.academyId;
    const staffPerm = doc.owner.teacherProfile ? PERMISSIONS.TEACHERS_READ : PERMISSIONS.STUDENTS_READ;
    const isStaff = sameAcademy && (auth.isSuperAdmin || auth.permissions.has(staffPerm));

    if (!isOwner && !isParent && !isStaff) throw new NotFoundException();
    return this.storage.presignDownload(doc.storageKey, doc.fileName);
  }

  async remove(auth: AuthContext, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.ownerId !== auth.userId) throw new NotFoundException();
    await this.storage.delete(doc.storageKey);
    await this.prisma.document.delete({ where: { id } });
  }
}
