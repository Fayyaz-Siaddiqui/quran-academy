import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HomeworkStatus, Prisma } from '@prisma/client';
import { PERMISSIONS } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { AssignHomeworkDto, RecordProgressDto, ReviewHomeworkDto, SubmitHomeworkDto } from './learning.dto';

/** Quran surah ayah counts (index = surah number). Used to validate progress entries. */
const AYAH_COUNTS = [0, 7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  /** A teacher may act on a student they teach via an enrollment or a shared class. */
  private async assertTeaches(teacherId: string, studentId: string) {
    const [enr, cls] = await Promise.all([
      this.prisma.enrollment.count({ where: { teacherId, studentId } }),
      this.prisma.classSession.count({ where: { teacherId, attendees: { some: { studentId } } } }),
    ]);
    if (!enr && !cls) throw new ForbiddenException('You do not teach this student');
  }

  /** Student themself, their parent, or staff in the same academy with students.read. */
  async assertCanViewStudent(auth: AuthContext, studentId: string) {
    if (auth.userId === studentId) return;
    const parent = await this.prisma.parentChild.count({ where: { parentId: auth.userId, childId: studentId } });
    if (parent) return;
    const student = await this.prisma.user.findUnique({ where: { id: studentId }, select: { academyId: true } });
    if (!student) throw new NotFoundException();
    if (auth.isSuperAdmin) return;
    if (auth.permissions.has(PERMISSIONS.STUDENTS_READ) && student.academyId === auth.academyId) return;
    // Same rule as assertTeaches: whoever may record a student's work may also read it.
    try {
      await this.assertTeaches(auth.userId, studentId);
      return;
    } catch {
      /* not their teacher */
    }
    throw new NotFoundException();
  }

  // ───── Homework ─────

  async assignHomework(auth: AuthContext, dto: AssignHomeworkDto) {
    await this.assertTeaches(auth.userId, dto.studentId);
    if (dto.classSessionId) {
      const cls = await this.prisma.classSession.count({ where: { id: dto.classSessionId, teacherId: auth.userId } });
      if (!cls) throw new BadRequestException('Class not found');
    }
    const hw = await this.prisma.homework.create({
      data: { ...dto, teacherId: auth.userId, dueAt: dto.dueAt ? new Date(dto.dueAt) : null },
      include: { course: { select: { title: true } } },
    });
    await this.notifications.notify(dto.studentId, {
      type: 'homework.assigned',
      title: 'New homework',
      body: `${hw.course.title}: ${hw.title}`,
      data: { homeworkId: hw.id },
    });
    return hw;
  }

  async listHomework(auth: AuthContext, studentId: string, status?: HomeworkStatus) {
    await this.assertCanViewStudent(auth, studentId);
    await this.refreshOverdue(studentId);
    return this.prisma.homework.findMany({
      where: { studentId, ...(status ? { status } : {}) },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, fullName: true } },
        submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });
  }

  async teacherHomework(teacherId: string, status?: HomeworkStatus) {
    await this.prisma.homework.updateMany({
      where: { teacherId, status: 'ASSIGNED', dueAt: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
    return this.prisma.homework.findMany({
      where: { teacherId, ...(status ? { status } : {}) },
      include: { student: { select: { id: true, fullName: true } }, course: { select: { title: true } }, submissions: { orderBy: { submittedAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async submitHomework(auth: AuthContext, homeworkId: string, dto: SubmitHomeworkDto) {
    const hw = await this.prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw || hw.studentId !== auth.userId) throw new NotFoundException();
    if (hw.status === 'REVIEWED') throw new BadRequestException('Homework has already been reviewed');
    if (!dto.content && !dto.documentId) throw new BadRequestException('Add an answer or an attachment');

    let storageKey: string | undefined;
    if (dto.documentId) {
      const doc = await this.prisma.document.findFirst({ where: { id: dto.documentId, ownerId: auth.userId, type: 'HOMEWORK_ATTACHMENT' } });
      if (!doc) throw new BadRequestException('Attachment not found');
      storageKey = doc.storageKey;
    }
    const [submission] = await this.prisma.$transaction([
      this.prisma.homeworkSubmission.create({ data: { homeworkId, studentId: auth.userId, content: dto.content, storageKey } }),
      this.prisma.homework.update({ where: { id: homeworkId }, data: { status: 'SUBMITTED' } }),
    ]);
    await this.notifications.notify(hw.teacherId, {
      type: 'homework.submitted',
      title: 'Homework submitted',
      body: `"${hw.title}" has been submitted for review.`,
      data: { homeworkId },
    });
    return submission;
  }

  async reviewHomework(auth: AuthContext, homeworkId: string, dto: ReviewHomeworkDto) {
    const hw = await this.prisma.homework.findUnique({ where: { id: homeworkId }, include: { submissions: { orderBy: { submittedAt: 'desc' }, take: 1 } } });
    if (!hw || hw.teacherId !== auth.userId) throw new NotFoundException();
    const latest = hw.submissions[0];
    if (!latest) throw new BadRequestException('Nothing has been submitted yet');
    await this.prisma.$transaction([
      this.prisma.homeworkSubmission.update({ where: { id: latest.id }, data: { grade: dto.grade, feedback: dto.feedback, reviewedAt: new Date() } }),
      this.prisma.homework.update({ where: { id: homeworkId }, data: { status: 'REVIEWED' } }),
    ]);
    await this.notifications.notify(hw.studentId, {
      type: 'homework.reviewed',
      title: 'Homework reviewed',
      body: `Your teacher reviewed "${hw.title}".`,
      data: { homeworkId },
    });
    return { id: homeworkId, status: 'REVIEWED' };
  }

  async submissionAttachmentUrl(auth: AuthContext, submissionId: string) {
    const sub = await this.prisma.homeworkSubmission.findUnique({ where: { id: submissionId }, include: { homework: true } });
    if (!sub?.storageKey) throw new NotFoundException();
    if (sub.homework.teacherId !== auth.userId) await this.assertCanViewStudent(auth, sub.studentId);
    return this.storage.presignDownload(sub.storageKey);
  }

  private async refreshOverdue(studentId: string) {
    await this.prisma.homework.updateMany({
      where: { studentId, status: 'ASSIGNED', dueAt: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
  }

  // ───── Quran progress ─────

  async recordProgress(auth: AuthContext, dto: RecordProgressDto) {
    await this.assertTeaches(auth.userId, dto.studentId);
    if (dto.type === 'QAIDA') {
      if (!dto.qaidaLesson) throw new BadRequestException('Qaida lesson number is required');
    } else {
      const max = AYAH_COUNTS[dto.surah];
      if (!max) throw new BadRequestException('Invalid surah');
      if (dto.ayahFrom < 1 || dto.ayahTo > max || dto.ayahFrom > dto.ayahTo) {
        throw new BadRequestException(`Surah ${dto.surah} has ${max} ayahs`);
      }
    }
    const entry = await this.prisma.quranProgress.create({ data: { ...dto, teacherId: auth.userId } });
    await this.notifications.notify(dto.studentId, {
      type: 'progress.recorded',
      title: 'Progress updated',
      body: 'Your teacher recorded new progress for you.',
      data: { progressId: entry.id },
    });
    return entry;
  }

  async listProgress(auth: AuthContext, studentId: string) {
    await this.assertCanViewStudent(auth, studentId);
    const entries = await this.prisma.quranProgress.findMany({
      where: { studentId },
      include: { teacher: { select: { fullName: true } } },
      orderBy: { recordedAt: 'desc' },
      take: 300,
    });
    // Memorized surahs = surahs whose every ayah is covered by MEMORIZATION entries.
    const covered = new Map<number, Set<number>>();
    for (const e of entries) {
      if (e.type !== 'MEMORIZATION' || e.surah < 1) continue;
      const set = covered.get(e.surah) ?? new Set<number>();
      for (let a = e.ayahFrom; a <= e.ayahTo; a++) set.add(a);
      covered.set(e.surah, set);
    }
    const memorizedSurahs = [...covered.entries()].filter(([s, set]) => set.size >= AYAH_COUNTS[s]!).map(([s]) => s);
    const memorizedAyahs = [...covered.values()].reduce((n, s) => n + s.size, 0);
    const lastQaida = entries.find((e) => e.type === 'QAIDA')?.qaidaLesson ?? null;
    return {
      summary: { memorizedSurahs, memorizedAyahs, totalAyahs: 6236, lastQaidaLesson: lastQaida },
      entries,
    };
  }

  // ───── Recordings ─────

  async listRecordings(auth: AuthContext, studentId: string) {
    await this.assertCanViewStudent(auth, studentId);
    return this.prisma.recording.findMany({
      where: { status: 'AVAILABLE', classSession: { attendees: { some: { studentId } } } },
      select: {
        id: true, title: true, durationSeconds: true, recordedAt: true,
        classSession: { select: { id: true, title: true, course: { select: { title: true } }, teacher: { select: { fullName: true } } } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 200,
    });
  }

  async recordingUrl(auth: AuthContext, recordingId: string) {
    const rec = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      include: { classSession: { select: { teacherId: true, academyId: true, attendees: { select: { studentId: true } } } } },
    });
    if (!rec || rec.status !== 'AVAILABLE' || !rec.storageKey) throw new NotFoundException();
    const cs = rec.classSession;
    const attendeeIds = cs.attendees.map((a) => a.studentId);
    let allowed = cs.teacherId === auth.userId || attendeeIds.includes(auth.userId);
    if (!allowed) {
      const children = await this.prisma.parentChild.findMany({ where: { parentId: auth.userId }, select: { childId: true } });
      allowed = children.some((c) => attendeeIds.includes(c.childId));
    }
    if (!allowed) {
      allowed = auth.isSuperAdmin || (auth.permissions.has(PERMISSIONS.RECORDINGS_READ) && cs.academyId === auth.academyId);
    }
    if (!allowed) throw new NotFoundException();
    return this.storage.presignDownload(rec.storageKey);
  }

  // ───── Announcements ─────

  async announcementsFor(auth: AuthContext) {
    if (!auth.academyId) return [];
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        academyId: auth.academyId,
        publishedAt: { lte: now },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ audience: { isEmpty: true } }, { audience: { hasSome: auth.roles } }] },
        ],
      } satisfies Prisma.AnnouncementWhereInput,
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, body: true, publishedAt: true, audience: true },
    });
  }
}
