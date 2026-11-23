import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TeacherApprovalStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthContext } from '../../common/types/auth-context';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';

export interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async applications(academyId: string, q: PaginationQueryDto & { status?: TeacherApprovalStatus }) {
    const where: Prisma.TeacherProfileWhereInput = {
      user: {
        academyId,
        deletedAt: null,
        ...(q.search ? { fullName: { contains: q.search, mode: 'insensitive' } } : {}),
      },
      approvalStatus: q.status ?? TeacherApprovalStatus.PENDING,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.teacherProfile.findMany({
        where,
        include: {
          availability: true,
          user: {
            select: {
              id: true, fullName: true, email: true, phone: true, country: true, timezone: true, status: true,
              emailVerifiedAt: true, createdAt: true,
              documents: { select: { id: true, type: true, fileName: true, mimeType: true, sizeBytes: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        ...paginate(q),
      }),
      this.prisma.teacherProfile.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async review(academyId: string, auth: AuthContext, teacherId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: { userId: teacherId, user: { academyId, deletedAt: null } },
      include: { user: true },
    });
    if (!profile) throw new NotFoundException();
    if (profile.approvalStatus === decision) throw new BadRequestException(`Application is already ${decision.toLowerCase()}`);
    if (decision === 'REJECTED' && !notes) throw new BadRequestException('Please give a reason for rejection');

    // Approval of an unverified applicant leaves them PENDING_VERIFICATION; verifying will then activate them.
    const nextStatus =
      decision === 'REJECTED'
        ? UserStatus.REJECTED
        : profile.user.emailVerifiedAt
          ? UserStatus.ACTIVE
          : UserStatus.PENDING_VERIFICATION;

    await this.prisma.$transaction([
      this.prisma.teacherProfile.update({
        where: { userId: teacherId },
        data: {
          approvalStatus: decision,
          reviewedById: auth.userId,
          reviewedAt: new Date(),
          reviewNotes: notes,
          isPublic: decision === 'APPROVED' ? profile.isPublic : false,
        },
      }),
      this.prisma.user.update({
        where: { id: teacherId },
        data: { status: nextStatus, statusChangedAt: new Date(), statusChangedById: auth.userId, statusReason: notes },
      }),
    ]);
    await this.access.invalidateUser(teacherId);
    await this.audit.record({
      academyId, actorId: auth.userId, action: `teacher.${decision.toLowerCase()}`, entity: 'User', entityId: teacherId,
      metadata: notes ? { notes } : undefined,
    });

    if (profile.user.email) {
      if (decision === 'APPROVED') {
        await this.mail.send({ to: profile.user.email, template: 'teacher-approved', data: { name: profile.user.fullName, loginUrl: `${this.config.get('APP_URL')}/login` } });
      } else {
        await this.mail.send({ to: profile.user.email, template: 'teacher-rejected', data: { name: profile.user.fullName, reason: notes } });
      }
    }
    return { userId: teacherId, approvalStatus: decision, status: nextStatus };
  }

  /** Public faculty page — approved teachers who opted in (or were published by admin). */
  async publicList(academyId: string) {
    const teachers = await this.prisma.teacherProfile.findMany({
      where: { isPublic: true, approvalStatus: 'APPROVED', user: { academyId, status: 'ACTIVE', deletedAt: null } },
      select: {
        bio: true, experienceYears: true, languages: true, certifications: true, specialties: true,
        user: { select: { id: true, fullName: true, country: true, avatarKey: true } },
      },
      orderBy: { experienceYears: 'desc' },
    });
    return Promise.all(
      teachers.map(async (t) => ({
        id: t.user.id,
        fullName: t.user.fullName,
        country: t.user.country,
        bio: t.bio,
        experienceYears: t.experienceYears,
        languages: t.languages,
        certifications: t.certifications,
        specialties: t.specialties,
        avatarUrl: t.user.avatarKey && this.storage.enabled ? (await this.storage.presignDownload(t.user.avatarKey)).url : null,
      })),
    );
  }

  async setPublic(academyId: string, teacherId: string, isPublic: boolean, specialties?: string[]) {
    const { count } = await this.prisma.teacherProfile.updateMany({
      where: { userId: teacherId, approvalStatus: 'APPROVED', user: { academyId } },
      data: { isPublic, ...(specialties ? { specialties } : {}) },
    });
    if (!count) throw new NotFoundException('Approved teacher not found');
    return { userId: teacherId, isPublic };
  }

  async myProfile(userId: string) {
    return this.prisma.teacherProfile.findUniqueOrThrow({ where: { userId }, include: { availability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } } });
  }

  async updateMyProfile(userId: string, data: { bio?: string; languages?: string[]; certifications?: string[] }) {
    return this.prisma.teacherProfile.update({ where: { userId }, data });
  }

  async replaceAvailability(userId: string, timezone: string, slots: AvailabilitySlot[]) {
    for (const s of slots) if (s.startTime >= s.endTime) throw new BadRequestException('Each slot must end after it starts');
    await this.prisma.$transaction([
      this.prisma.teacherAvailability.deleteMany({ where: { teacherId: userId } }),
      this.prisma.teacherAvailability.createMany({ data: slots.map((s) => ({ ...s, teacherId: userId, timezone })) }),
    ]);
    return this.myProfile(userId);
  }
}
