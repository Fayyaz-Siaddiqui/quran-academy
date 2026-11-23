import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceStatus, ClassStatus, Prisma } from '@prisma/client';
import { SOCKET_EVENTS } from '@qa/config';
import { ClassSessionSummary, PERMISSIONS, SystemRole } from '@qa/shared-types';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ZoomService } from '../zoom/zoom.service';
import { ClassListQueryDto, MarkAttendanceDto, RescheduleDto, ScheduleClassDto } from './classes.dto';

export const CLASS_SUMMARY_INCLUDE = {
  course: { select: { id: true, title: true, slug: true } },
  teacher: { select: { id: true, fullName: true, avatarKey: true } },
  attendees: { select: { studentId: true, status: true } },
} satisfies Prisma.ClassSessionInclude;

type ClassWithSummary = Prisma.ClassSessionGetPayload<{ include: typeof CLASS_SUMMARY_INCLUDE }>;

@Injectable()
export class ClassesService {
  private readonly joinWindowMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly zoom: ZoomService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly config: ConfigService,
  ) {
    this.joinWindowMs = config.get<number>('CLASS_JOIN_WINDOW_MINUTES', 10) * 60_000;
  }

  // ───────────── Scheduling (admin) ─────────────

  async schedule(academyId: string, auth: AuthContext, dto: ScheduleClassDto) {
    const [course, teacher, students] = await Promise.all([
      this.prisma.course.findFirst({ where: { id: dto.courseId, academyId } }),
      this.prisma.user.findFirst({
        where: { id: dto.teacherId, academyId, status: 'ACTIVE', teacherProfile: { approvalStatus: 'APPROVED' } },
      }),
      this.prisma.user.findMany({
        where: { id: { in: dto.studentIds }, academyId, deletedAt: null, roles: { some: { role: { slug: SystemRole.STUDENT } } } },
        select: { id: true },
      }),
    ]);
    if (!course) throw new BadRequestException('Course not found');
    if (!teacher) throw new BadRequestException('Teacher not found or not approved');
    if (students.length !== new Set(dto.studentIds).size) throw new BadRequestException('One or more students are invalid');

    const branchId = this.tenant.branchScope(auth) ?? dto.branchId ?? null;
    const occurrences = dto.repeatWeeks ?? 1;
    const first = new Date(dto.startsAt);
    if (first.getTime() < Date.now() - 60_000) throw new BadRequestException('Start time is in the past');

    const slots = Array.from({ length: occurrences }, (_, i) => {
      const startsAt = new Date(first.getTime() + i * 7 * 86_400_000);
      return { startsAt, endsAt: new Date(startsAt.getTime() + dto.durationMinutes * 60_000) };
    });

    for (const slot of slots) await this.assertNoConflict(dto.teacherId, dto.studentIds, slot.startsAt, slot.endsAt);

    const created = await this.prisma.$transaction(
      slots.map((slot, i) =>
        this.prisma.classSession.create({
          data: {
            academyId,
            branchId,
            courseId: course.id,
            teacherId: teacher.id,
            title: occurrences > 1 ? `${dto.title} (${i + 1}/${occurrences})` : dto.title,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            zoomSessionName: `qa-${randomBytes(12).toString('hex')}`,
            attendees: { create: dto.studentIds.map((studentId) => ({ studentId })) },
          },
          include: CLASS_SUMMARY_INCLUDE,
        }),
      ),
    );

    await this.notifications.notifyMany([teacher.id, ...dto.studentIds], {
      type: 'class.scheduled',
      title: occurrences > 1 ? `${occurrences} classes scheduled` : 'New class scheduled',
      body: `${course.title}: ${dto.title}`,
      data: { classSessionIds: created.map((c) => c.id) },
    });
    return created.map((c) => this.toSummary(c, auth.userId));
  }

  /** Overlap check: [start, end) intersects any non-cancelled class for the teacher or any student. */
  private async assertNoConflict(teacherId: string, studentIds: string[], startsAt: Date, endsAt: Date, excludeId?: string) {
    const clash = await this.prisma.classSession.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        OR: [{ teacherId }, { attendees: { some: { studentId: { in: studentIds } } } }],
      },
      select: { id: true, startsAt: true, teacherId: true },
    });
    if (clash) {
      const who = clash.teacherId === teacherId ? 'The teacher' : 'A student';
      throw new ConflictException(`${who} already has a class at ${clash.startsAt.toISOString()}`);
    }
  }

  async reschedule(academyId: string, auth: AuthContext, id: string, dto: RescheduleDto) {
    const cls = await this.prisma.classSession.findFirst({ where: { id, academyId }, include: { attendees: true } });
    if (!cls) throw new NotFoundException();
    if (cls.status !== 'SCHEDULED') throw new BadRequestException('Only scheduled classes can be rescheduled');
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000);
    await this.assertNoConflict(cls.teacherId, cls.attendees.map((a) => a.studentId), startsAt, endsAt, id);
    const updated = await this.prisma.classSession.update({ where: { id }, data: { startsAt, endsAt }, include: CLASS_SUMMARY_INCLUDE });
    await this.notifications.notifyMany([cls.teacherId, ...cls.attendees.map((a) => a.studentId)], {
      type: 'class.rescheduled',
      title: 'Class rescheduled',
      body: `"${cls.title}" moved to ${startsAt.toISOString()}`,
      data: { classSessionId: id },
    });
    return this.toSummary(updated, auth.userId);
  }

  async cancel(academyId: string, id: string, reason: string) {
    const cls = await this.prisma.classSession.findFirst({ where: { id, academyId }, include: { attendees: true } });
    if (!cls) throw new NotFoundException();
    if (!['SCHEDULED', 'LIVE'].includes(cls.status)) throw new BadRequestException('Class cannot be cancelled');
    await this.prisma.classSession.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: reason } });
    await this.notifications.notifyMany([cls.teacherId, ...cls.attendees.map((a) => a.studentId)], {
      type: 'class.cancelled',
      title: 'Class cancelled',
      body: `"${cls.title}" was cancelled: ${reason}`,
      data: { classSessionId: id },
    });
    return { id, status: 'CANCELLED' };
  }

  // ───────────── Listing ─────────────

  /** Classes visible to the caller, scoped by persona. */
  async list(auth: AuthContext, q: ClassListQueryDto, academyIdForStaff?: string) {
    const now = new Date();
    const where: Prisma.ClassSessionWhereInput = {
      ...(q.from || q.to ? { startsAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } } : {}),
      ...(q.scope === 'upcoming' ? { endsAt: { gte: now }, status: { in: ['SCHEDULED', 'LIVE'] } } : {}),
      ...(q.scope === 'past' ? { endsAt: { lt: now } } : {}),
      ...(q.status ? { status: q.status } : {}),
    };

    // Teachers hold classes.read too, but must only ever see their own classes.
    const isStaff = auth.isSuperAdmin || (auth.permissions.has(PERMISSIONS.CLASSES_READ) && !auth.roles.includes(SystemRole.TEACHER));
    if (academyIdForStaff && isStaff) {
      where.academyId = academyIdForStaff;
      const branch = this.tenant.branchScope(auth);
      if (branch) where.branchId = branch;
      if (q.teacherId) where.teacherId = q.teacherId;
      if (q.studentId) where.attendees = { some: { studentId: q.studentId } };
    } else {
      const childIds = await this.childIds(auth.userId);
      where.OR = [
        { teacherId: auth.userId },
        { attendees: { some: { studentId: { in: [auth.userId, ...childIds] } } } },
      ];
      if (q.studentId) where.attendees = { some: { studentId: q.studentId } };
    }

    const items = await this.prisma.classSession.findMany({
      where,
      include: CLASS_SUMMARY_INCLUDE,
      orderBy: { startsAt: q.scope === 'past' ? 'desc' : 'asc' },
      take: q.limit ?? 50,
    });
    return items.map((c) => this.toSummary(c, auth.userId));
  }

  async get(auth: AuthContext, id: string) {
    const cls = await this.prisma.classSession.findUnique({
      where: { id },
      include: {
        ...CLASS_SUMMARY_INCLUDE,
        attendees: { select: { studentId: true, status: true, joinedAt: true, leftAt: true, student: { select: { fullName: true } } } },
        recordings: { where: { status: 'AVAILABLE' }, select: { id: true, title: true, durationSeconds: true, recordedAt: true } },
        homework: { select: { id: true, title: true, dueAt: true, status: true, studentId: true } },
      },
    });
    if (!cls) throw new NotFoundException();
    const access = await this.accessLevel(auth, cls);
    if (!access) throw new NotFoundException();

    // Students and parents only see their own/children's attendance and homework rows.
    const visibleStudentIds = access === 'participant' ? [auth.userId, ...(await this.childIds(auth.userId))] : null;
    return {
      ...this.toSummary(cls as unknown as ClassWithSummary, auth.userId),
      teacherNotes: access === 'participant' ? undefined : cls.teacherNotes,
      cancelReason: cls.cancelReason,
      attendees: cls.attendees
        .filter((a) => !visibleStudentIds || visibleStudentIds.includes(a.studentId))
        .map((a) => ({ studentId: a.studentId, fullName: a.student.fullName, status: a.status, joinedAt: a.joinedAt, leftAt: a.leftAt })),
      recordings: cls.recordings,
      homework: cls.homework.filter((h) => !visibleStudentIds || visibleStudentIds.includes(h.studentId)),
    };
  }

  // ───────────── Live classroom ─────────────

  /**
   * `asStudentId`: a parent joining for a young child. The token is issued in the
   * child's identity so Zoom webhooks mark the child's attendance, not the parent's.
   */
  async join(auth: AuthContext, id: string, asStudentId?: string) {
    if (asStudentId) {
      const link = await this.prisma.parentChild.count({ where: { parentId: auth.userId, childId: asStudentId } });
      const attendee = await this.prisma.classAttendee.count({ where: { classSessionId: id, studentId: asStudentId } });
      if (!link || !attendee) throw new NotFoundException();
      const cls = await this.prisma.classSession.findUniqueOrThrow({ where: { id }, include: { course: true } });
      if (!this.withinJoinWindow(cls)) {
        throw new BadRequestException({ message: 'This class is not open for joining right now', code: 'OUTSIDE_JOIN_WINDOW' });
      }
      const child = await this.prisma.user.findUniqueOrThrow({ where: { id: asStudentId }, select: { fullName: true } });
      return this.issueJoin(cls, asStudentId, child.fullName, 'participant', true);
    }
    return this.joinSelf(auth, id);
  }

  /** Which live-classroom provider to use: Zoom when configured (or forced), else Jitsi Meet. */
  private provider(): 'zoom' | 'jitsi' {
    const setting = this.config.get<string>('VIDEO_PROVIDER', 'auto');
    if (setting === 'zoom' || setting === 'jitsi') return setting;
    return this.zoom.configured ? 'zoom' : 'jitsi';
  }

  private async issueJoin(
    cls: { id: string; title: string; endsAt: Date; zoomSessionName: string; course: { title: string } },
    userId: string,
    userName: string,
    role: 'host' | 'participant',
    isAttendee: boolean,
  ) {
    const base = { classSessionId: cls.id, title: cls.title, courseTitle: cls.course.title, endsAt: cls.endsAt, userName, role };
    if (this.provider() === 'zoom') {
      return { provider: 'zoom' as const, ...base, ...this.zoom.signJoinToken({ sessionName: cls.zoomSessionName, userId, userName, role, validUntil: cls.endsAt }) };
    }
    // Jitsi: no webhooks, so attendance is recorded when an enrolled student is let in.
    // The room name is the class's random, unguessable session name and is only revealed after the access check above.
    if (isAttendee) await this.recordJoin(cls.zoomSessionName, userId);
    const domain = this.config.get<string>('JITSI_DOMAIN', 'meet.jit.si');
    const hash = [
      `userInfo.displayName=${encodeURIComponent(JSON.stringify(userName))}`,
      'config.prejoinConfig.enabled=false',
      `config.subject=${encodeURIComponent(JSON.stringify(cls.title))}`,
    ].join('&');
    return { provider: 'jitsi' as const, ...base, roomUrl: `https://${domain}/QuranAcademy-${cls.zoomSessionName}#${hash}` };
  }

  private async joinSelf(auth: AuthContext, id: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { id }, include: { attendees: true, course: true } });
    if (!cls) throw new NotFoundException();
    const access = await this.accessLevel(auth, cls);
    if (!access) throw new NotFoundException();

    const isTeacher = cls.teacherId === auth.userId;
    if (!this.withinJoinWindow(cls)) {
      throw new BadRequestException({ message: 'This class is not open for joining right now', code: 'OUTSIDE_JOIN_WINDOW' });
    }
    // Staff with access (e.g. quality supervisors) join as participants to observe.
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { fullName: true } });
    const isAttendee = cls.attendees.some((a) => a.studentId === auth.userId);
    return this.issueJoin(cls, auth.userId, me.fullName, isTeacher ? 'host' : 'participant', isAttendee);
  }

  async start(auth: AuthContext, id: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { id }, include: { attendees: true } });
    if (!cls || cls.teacherId !== auth.userId) throw new NotFoundException();
    if (cls.status !== 'SCHEDULED' && cls.status !== 'LIVE') throw new BadRequestException(`Class is ${cls.status.toLowerCase()}`);
    if (!this.withinJoinWindow(cls)) throw new BadRequestException('Class can only be started near its scheduled time');
    const updated = await this.prisma.classSession.update({
      where: { id },
      data: { status: 'LIVE', startedAt: cls.startedAt ?? new Date() },
    });
    this.broadcastStatus(updated.id, 'LIVE', cls.attendees.map((a) => a.studentId));
    await this.notifications.notifyMany(cls.attendees.map((a) => a.studentId), {
      type: 'class.live',
      title: 'Your class has started',
      body: `${cls.title} is live now — join from your dashboard.`,
      data: { classSessionId: id },
    });
    return { id, status: updated.status };
  }

  async end(auth: AuthContext, id: string, teacherNotes?: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { id }, include: { attendees: true } });
    if (!cls || cls.teacherId !== auth.userId) throw new NotFoundException();
    if (cls.status !== 'LIVE') throw new BadRequestException('Class is not live');
    await this.finalize(cls.id, teacherNotes);
    this.broadcastStatus(cls.id, 'COMPLETED', cls.attendees.map((a) => a.studentId));
    return { id, status: 'COMPLETED' };
  }

  /** Completes a class; anyone still SCHEDULED who joined becomes PRESENT, others ABSENT. */
  private async finalize(id: string, teacherNotes?: string) {
    await this.prisma.$transaction([
      this.prisma.classSession.update({
        where: { id },
        data: { status: 'COMPLETED', endedAt: new Date(), ...(teacherNotes !== undefined ? { teacherNotes } : {}) },
      }),
      this.prisma.classAttendee.updateMany({
        where: { classSessionId: id, status: 'SCHEDULED', joinedAt: { not: null } },
        data: { status: 'PRESENT' },
      }),
      this.prisma.classAttendee.updateMany({
        where: { classSessionId: id, status: 'SCHEDULED', joinedAt: null },
        data: { status: 'ABSENT' },
      }),
    ]);
  }

  /** Teacher's private notes on a class (visible to staff, never to students/parents). */
  async updateNotes(auth: AuthContext, id: string, teacherNotes: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { id }, select: { teacherId: true, status: true } });
    if (!cls || cls.teacherId !== auth.userId) throw new NotFoundException();
    if (cls.status === 'CANCELLED') throw new BadRequestException('Class was cancelled');
    await this.prisma.classSession.update({ where: { id }, data: { teacherNotes } });
    return { id, teacherNotes };
  }

  async markAttendance(auth: AuthContext, id: string, dto: MarkAttendanceDto) {
    const cls = await this.prisma.classSession.findUnique({ where: { id }, include: { attendees: true } });
    if (!cls) throw new NotFoundException();
    const isTeacher = cls.teacherId === auth.userId;
    const isManager = (auth.isSuperAdmin || auth.permissions.has(PERMISSIONS.CLASSES_MANAGE)) && (auth.isSuperAdmin || cls.academyId === auth.academyId);
    if (!isTeacher && !isManager) throw new ForbiddenException();
    if (cls.startsAt > new Date()) throw new BadRequestException('Attendance can be marked once the class has started');

    const enrolled = new Set(cls.attendees.map((a) => a.studentId));
    for (const e of dto.entries) if (!enrolled.has(e.studentId)) throw new BadRequestException('Student is not in this class');

    await this.prisma.$transaction(
      dto.entries.map((e) =>
        this.prisma.classAttendee.update({
          where: { classSessionId_studentId: { classSessionId: id, studentId: e.studentId } },
          data: { status: e.status as AttendanceStatus, markedById: auth.userId },
        }),
      ),
    );
    return this.get(auth, id);
  }

  // ───────────── Provider callbacks (Zoom webhooks) ─────────────

  async markLiveFromProvider(sessionName: string, providerSessionId?: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { zoomSessionName: sessionName }, include: { attendees: true } });
    if (!cls || cls.status === 'CANCELLED' || cls.status === 'COMPLETED') return;
    await this.prisma.classSession.update({
      where: { id: cls.id },
      data: { status: 'LIVE', startedAt: cls.startedAt ?? new Date(), zoomSessionId: providerSessionId ?? cls.zoomSessionId },
    });
    this.broadcastStatus(cls.id, 'LIVE', cls.attendees.map((a) => a.studentId));
  }

  async markEndedFromProvider(sessionName: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { zoomSessionName: sessionName }, include: { attendees: true } });
    if (!cls || cls.status !== 'LIVE') return;
    await this.finalize(cls.id);
    this.broadcastStatus(cls.id, 'COMPLETED', cls.attendees.map((a) => a.studentId));
  }

  async recordJoin(sessionName: string, userKey: string, at?: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { zoomSessionName: sessionName }, select: { id: true, startsAt: true } });
    if (!cls) return;
    const joinedAt = at ? new Date(at) : new Date();
    const late = joinedAt.getTime() - cls.startsAt.getTime() > 10 * 60_000;
    await this.prisma.classAttendee.updateMany({
      where: { classSessionId: cls.id, studentId: userKey, joinedAt: null },
      data: { joinedAt, status: late ? 'LATE' : 'PRESENT' },
    });
  }

  async recordLeave(sessionName: string, userKey: string, at?: string) {
    const cls = await this.prisma.classSession.findUnique({ where: { zoomSessionName: sessionName }, select: { id: true } });
    if (!cls) return;
    await this.prisma.classAttendee.updateMany({
      where: { classSessionId: cls.id, studentId: userKey },
      data: { leftAt: at ? new Date(at) : new Date() },
    });
  }

  /** Called by the scheduler: classes whose time has passed without ever going live. */
  async markMissedClasses() {
    const cutoff = new Date(Date.now() - 15 * 60_000);
    const missed = await this.prisma.classSession.findMany({
      where: { status: 'SCHEDULED', endsAt: { lt: cutoff } },
      select: { id: true },
      take: 500,
    });
    for (const m of missed) {
      await this.prisma.$transaction([
        this.prisma.classSession.update({ where: { id: m.id }, data: { status: 'MISSED' } }),
        this.prisma.classAttendee.updateMany({ where: { classSessionId: m.id, status: 'SCHEDULED' }, data: { status: 'ABSENT' } }),
      ]);
    }
    // Live classes abandoned without an end event.
    const stale = await this.prisma.classSession.findMany({
      where: { status: 'LIVE', endsAt: { lt: new Date(Date.now() - 60 * 60_000) } },
      select: { id: true },
      take: 500,
    });
    for (const s of stale) await this.finalize(s.id);
    return { missed: missed.length, autoCompleted: stale.length };
  }

  /** Called by the scheduler: reminders ~15 minutes before start. Idempotent per class via Redis key in caller. */
  async upcomingForReminder(windowStart: Date, windowEnd: Date) {
    return this.prisma.classSession.findMany({
      where: { status: 'SCHEDULED', startsAt: { gte: windowStart, lt: windowEnd } },
      include: { attendees: { select: { studentId: true } }, course: { select: { title: true } } },
    });
  }

  // ───────────── helpers ─────────────

  private withinJoinWindow(cls: { startsAt: Date; endsAt: Date; status: ClassStatus }) {
    const now = Date.now();
    return (
      (cls.status === 'SCHEDULED' || cls.status === 'LIVE') &&
      now >= cls.startsAt.getTime() - this.joinWindowMs &&
      now <= cls.endsAt.getTime()
    );
  }

  private broadcastStatus(classSessionId: string, status: ClassStatus, studentIds: string[]) {
    for (const sid of studentIds) this.gateway.toUser(sid, SOCKET_EVENTS.CLASS_STATUS, { classSessionId, status });
  }

  async childIds(parentId: string) {
    const links = await this.prisma.parentChild.findMany({ where: { parentId }, select: { childId: true } });
    return links.map((l) => l.childId);
  }

  /** 'teacher' | 'participant' (student or parent of student) | 'staff' | null */
  async accessLevel(
    auth: AuthContext,
    cls: { teacherId: string; academyId: string; branchId: string | null; attendees: { studentId: string }[] },
  ): Promise<'teacher' | 'participant' | 'staff' | null> {
    if (cls.teacherId === auth.userId) return 'teacher';
    const attendeeIds = cls.attendees.map((a) => a.studentId);
    if (attendeeIds.includes(auth.userId)) return 'participant';
    const children = await this.childIds(auth.userId);
    if (children.some((c) => attendeeIds.includes(c))) return 'participant';
    if (auth.isSuperAdmin) return 'staff';
    if (auth.permissions.has(PERMISSIONS.CLASSES_READ) && cls.academyId === auth.academyId && !auth.roles.includes(SystemRole.TEACHER)) {
      const branch = this.tenant.branchScope(auth);
      if (!branch || branch === cls.branchId) return 'staff';
    }
    return null;
  }

  toSummary(c: ClassWithSummary, viewerId: string): ClassSessionSummary {
    const mine = c.attendees.find((a) => a.studentId === viewerId);
    return {
      id: c.id,
      title: c.title,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      status: c.status,
      course: c.course,
      teacher: { id: c.teacher.id, fullName: c.teacher.fullName, avatarUrl: null },
      attendanceStatus: mine?.status,
      canJoin: this.withinJoinWindow(c),
    };
  }
}
