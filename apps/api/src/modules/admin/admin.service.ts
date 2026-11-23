import { Injectable } from '@nestjs/common';
import { AttendanceStatus, EnrollmentStatus, Prisma } from '@prisma/client';
import { AdminOverview, SystemRole } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { addDays, dayBounds, localDate, localDays, monthStart, weekday, ymdString, zonedMidnight } from '../../common/utils/time';
import { CLASS_SUMMARY_INCLUDE, ClassesService } from '../classes/classes.service';

const DAY = 86_400_000;
const ATTENDED: AttendanceStatus[] = ['PRESENT', 'LATE'];
const MARKED: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

export interface Scope {
  academyId: string;
  /** Set for branch managers: every metric is limited to their branch. */
  branchId: string | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
  ) {}

  async overview(scope: Scope, viewerId: string, timezone: string): Promise<AdminOverview> {
    const { academyId, branchId } = scope;
    const now = new Date();
    const today = dayBounds(timezone, now);
    const branchUser: Prisma.UserWhereInput = branchId ? { branchId } : {};
    const branchClass: Prisma.ClassSessionWhereInput = branchId ? { branchId } : {};
    const users = (role: string): Prisma.UserWhereInput => ({ academyId, deletedAt: null, ...branchUser, roles: { some: { role: { slug: role } } } });
    const classes: Prisma.ClassSessionWhereInput = { academyId, ...branchClass };

    // Week buckets start on Monday in the viewer's zone, 8 weeks back.
    // Calendar arithmetic, not 24 h steps, so buckets stay on local midnights across DST changes.
    const todayDate = localDate(timezone, now);
    const mondayThisWeek = addDays(todayDate, -((weekday(todayDate) + 6) % 7));
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const startDate = addDays(mondayThisWeek, (i - 7) * 7);
      return { startDate, start: zonedMidnight(timezone, startDate), end: zonedMidnight(timezone, addDays(startDate, 7)) };
    });
    const days = localDays(timezone, todayDate, 7);
    const firstWeek = weeks[0]!.start;
    const horizon = days[6]!.end;

    const [
      activeStudents, activeTeachers, classesToday, liveNow, attendance, completed,
      pendingTeachers, newTrials, newMessages, awaitingEnrollment, hwReview,
      signups, upcoming, todays, recent,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...users(SystemRole.STUDENT), status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { ...users(SystemRole.TEACHER), status: 'ACTIVE', teacherProfile: { approvalStatus: 'APPROVED' } } }),
      this.prisma.classSession.count({ where: { ...classes, startsAt: { gte: today.start, lt: today.end }, status: { not: 'CANCELLED' } } }),
      this.prisma.classSession.count({ where: { ...classes, status: 'LIVE' } }),
      this.prisma.classAttendee.groupBy({
        by: ['status'],
        where: { status: { in: MARKED }, classSession: { ...classes, startsAt: { gte: new Date(now.getTime() - 30 * DAY), lt: now } } },
        _count: true,
      }),
      this.prisma.classSession.findMany({
        where: { ...classes, status: 'COMPLETED', startsAt: { gte: monthStart(timezone, now) } },
        select: { startedAt: true, endedAt: true, startsAt: true, endsAt: true },
      }),
      this.prisma.teacherProfile.count({ where: { approvalStatus: 'PENDING', user: { academyId, deletedAt: null, ...branchUser } } }),
      branchId ? Promise.resolve(0) : this.prisma.trialBooking.count({ where: { academyId, status: 'NEW' } }),
      branchId ? Promise.resolve(0) : this.prisma.contactMessage.count({ where: { academyId, status: 'NEW' } }),
      this.prisma.user.count({ where: { ...users(SystemRole.STUDENT), status: 'ACTIVE', studentEnrollments: { none: { status: { in: ['ACTIVE', 'PAUSED'] } } } } }),
      this.prisma.homework.count({ where: { status: 'SUBMITTED', student: { academyId, ...branchUser } } }),
      this.prisma.user.findMany({ where: { ...users(SystemRole.STUDENT), createdAt: { gte: firstWeek } }, select: { createdAt: true } }),
      this.prisma.classSession.findMany({
        where: { ...classes, startsAt: { gte: today.start, lt: horizon }, status: { in: ['SCHEDULED', 'LIVE', 'COMPLETED'] } },
        select: { startsAt: true },
      }),
      this.prisma.classSession.findMany({
        where: { ...classes, startsAt: { gte: today.start, lt: today.end }, status: { not: 'CANCELLED' } },
        include: { ...CLASS_SUMMARY_INCLUDE, attendees: { select: { studentId: true, status: true, student: { select: { fullName: true } } } } },
        orderBy: { startsAt: 'asc' },
        take: 40,
      }),
      this.prisma.user.findMany({
        where: { academyId, deletedAt: null, ...branchUser, roles: { some: { role: { slug: { in: [SystemRole.STUDENT, SystemRole.PARENT, SystemRole.TEACHER] } } } } },
        select: { id: true, fullName: true, status: true, country: true, createdAt: true, roles: { select: { role: { select: { slug: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const marked = attendance.reduce((n, a) => n + a._count, 0);
    const attended = attendance.filter((a) => ATTENDED.includes(a.status)).reduce((n, a) => n + a._count, 0);
    const minutes = completed.reduce((sum, c) => sum + Math.max(0, ((c.endedAt ?? c.endsAt).getTime() - (c.startedAt ?? c.startsAt).getTime()) / 60_000), 0);

    const signupsByWeek = weeks.map((w) => ({
      weekStart: ymdString(w.startDate),
      count: signups.filter((s) => s.createdAt >= w.start && s.createdAt < w.end).length,
    }));
    const classesNext7Days = days.map((d) => ({
      date: ymdString(d.date),
      count: upcoming.filter((c) => c.startsAt >= d.start && c.startsAt < d.end).length,
    }));

    return {
      generatedAt: now.toISOString(),
      timezone,
      kpis: {
        activeStudents,
        activeTeachers,
        classesToday,
        liveNow,
        attendanceRate30d: marked ? Math.round((attended / marked) * 100) : 100,
        completedThisMonth: completed.length,
        teachingHoursThisMonth: Math.round((minutes / 60) * 10) / 10,
      },
      actions: {
        pendingTeacherApprovals: pendingTeachers,
        newTrialBookings: newTrials,
        newContactMessages: newMessages,
        studentsAwaitingEnrollment: awaitingEnrollment,
        homeworkAwaitingReview: hwReview,
      },
      signupsByWeek,
      classesNext7Days,
      todaysClasses: todays.map((c) => ({
        ...this.classes.toSummary(c as never, viewerId),
        attendees: c.attendees.map((a) => ({ studentId: a.studentId, fullName: a.student.fullName, status: a.status })),
      })),
      recentSignups: recent.map((u) => ({
        id: u.id, fullName: u.fullName, status: u.status, country: u.country, createdAt: u.createdAt.toISOString(),
        role: u.roles.map((r) => r.role.slug).find((s) => s === 'teacher' || s === 'parent' || s === 'student') ?? 'user',
      })),
    };
  }

  async enrollments(scope: Scope, q: PaginationQueryDto & { status?: EnrollmentStatus; studentId?: string; teacherId?: string; courseId?: string }) {
    const where: Prisma.EnrollmentWhereInput = {
      course: { academyId: scope.academyId },
      student: { deletedAt: null, ...(scope.branchId ? { branchId: scope.branchId } : {}), ...(q.search ? { fullName: { contains: q.search, mode: 'insensitive' } } : {}) },
      ...(q.status ? { status: q.status } : {}),
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.teacherId ? { teacherId: q.teacherId } : {}),
      ...(q.courseId ? { courseId: q.courseId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        select: {
          id: true, status: true, startedAt: true, createdAt: true,
          student: { select: { id: true, fullName: true, email: true, country: true, timezone: true } },
          course: { select: { id: true, title: true } },
          teacher: { select: { id: true, fullName: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        ...paginate(q),
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  /** Active students with no active/paused enrollment — the enrolment to-do list. */
  async studentsAwaitingEnrollment(scope: Scope) {
    return this.prisma.user.findMany({
      where: {
        academyId: scope.academyId, deletedAt: null, status: 'ACTIVE',
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        roles: { some: { role: { slug: SystemRole.STUDENT } } },
        studentEnrollments: { none: { status: { in: ['ACTIVE', 'PAUSED'] } } },
      },
      select: {
        id: true, fullName: true, email: true, country: true, timezone: true, createdAt: true,
        studentProfile: { select: { preferredClassTiming: true, preferredCourse: { select: { id: true, title: true } } } },
        childLinks: { select: { parent: { select: { fullName: true, email: true, phone: true } } }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
}
