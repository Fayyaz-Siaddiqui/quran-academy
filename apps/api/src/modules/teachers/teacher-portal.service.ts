import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { TeacherDashboard, TeacherStudent } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { dayBounds, monthStart } from '../../common/utils/time';
import { CLASS_SUMMARY_INCLUDE, ClassesService } from '../classes/classes.service';

const ROSTER_LOOKBACK_DAYS = 180;
const ATTENDED: AttendanceStatus[] = ['PRESENT', 'LATE'];
const MARKED: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

/** Read models for the teacher's own portal. Every query is scoped to `teacherId`. */
@Injectable()
export class TeacherPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
  ) {}

  async dashboard(teacherId: string): Promise<TeacherDashboard> {
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId }, select: { id: true, fullName: true, timezone: true } });
    if (!teacher) throw new NotFoundException();
    const now = new Date();
    const { start, end } = dayBounds(teacher.timezone, now);
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const since7 = new Date(now.getTime() - 7 * 86_400_000);

    const [today, upcoming, awaitingNotes, reviews, reviewCount, monthClasses, attendance, roster] = await Promise.all([
      this.prisma.classSession.findMany({
        where: { teacherId, startsAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
        include: CLASS_SUMMARY_INCLUDE,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.classSession.findMany({
        where: { teacherId, status: { in: ['SCHEDULED', 'LIVE'] }, startsAt: { gte: end } },
        include: CLASS_SUMMARY_INCLUDE,
        orderBy: { startsAt: 'asc' },
        take: 6,
      }),
      this.prisma.classSession.findMany({
        where: { teacherId, status: 'COMPLETED', endsAt: { gte: since7 }, OR: [{ teacherNotes: null }, { teacherNotes: '' }] },
        include: CLASS_SUMMARY_INCLUDE,
        orderBy: { startsAt: 'desc' },
        take: 6,
      }),
      this.prisma.homework.findMany({
        where: { teacherId, status: 'SUBMITTED' },
        include: {
          student: { select: { id: true, fullName: true } },
          course: { select: { title: true } },
          submissions: { orderBy: { submittedAt: 'desc' }, take: 1, select: { submittedAt: true } },
        },
        orderBy: { updatedAt: 'asc' },
        take: 6,
      }),
      this.prisma.homework.count({ where: { teacherId, status: 'SUBMITTED' } }),
      this.prisma.classSession.findMany({
        where: { teacherId, status: 'COMPLETED', startsAt: { gte: monthStart(teacher.timezone, now) } },
        select: { startedAt: true, endedAt: true, startsAt: true, endsAt: true },
      }),
      this.prisma.classAttendee.groupBy({
        by: ['status'],
        where: { classSession: { teacherId, startsAt: { gte: since30, lt: now } }, status: { in: MARKED } },
        _count: true,
      }),
      this.activeStudentIds(teacherId),
    ]);

    // Prefer actual start/end; fall back to the scheduled slot.
    const minutes = monthClasses.reduce((sum, c) => {
      const s = c.startedAt ?? c.startsAt;
      const e = c.endedAt ?? c.endsAt;
      return sum + Math.max(0, (e.getTime() - s.getTime()) / 60_000);
    }, 0);
    const marked = attendance.reduce((n, a) => n + a._count, 0);
    const attended = attendance.filter((a) => ATTENDED.includes(a.status)).reduce((n, a) => n + a._count, 0);

    return {
      teacher,
      todaysClasses: today.map((c) => this.classes.toSummary(c, teacherId)),
      upcomingClasses: upcoming.map((c) => this.classes.toSummary(c, teacherId)),
      classesAwaitingNotes: awaitingNotes.map((c) => this.classes.toSummary(c, teacherId)),
      pendingReviews: reviews.map((h) => ({
        id: h.id,
        title: h.title,
        studentId: h.student.id,
        studentName: h.student.fullName,
        courseTitle: h.course.title,
        submittedAt: (h.submissions[0]?.submittedAt ?? h.updatedAt).toISOString(),
      })),
      stats: {
        activeStudents: roster.size,
        classesThisMonth: monthClasses.length,
        hoursThisMonth: Math.round((minutes / 60) * 10) / 10,
        attendanceRate30d: marked ? Math.round((attended / marked) * 100) : 100,
        pendingReviewCount: reviewCount,
      },
    };
  }

  /** Students with an active enrollment with this teacher, or a class with them in the lookback window / future. */
  private async activeStudentIds(teacherId: string) {
    const since = new Date(Date.now() - ROSTER_LOOKBACK_DAYS * 86_400_000);
    const [enr, att] = await Promise.all([
      this.prisma.enrollment.findMany({ where: { teacherId, status: { in: ['ACTIVE', 'PAUSED', 'PENDING'] } }, select: { studentId: true } }),
      this.prisma.classAttendee.findMany({
        where: { classSession: { teacherId, startsAt: { gte: since }, status: { not: 'CANCELLED' } } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
    ]);
    return new Set([...enr.map((e) => e.studentId), ...att.map((a) => a.studentId)]);
  }

  async students(teacherId: string): Promise<TeacherStudent[]> {
    const ids = [...(await this.activeStudentIds(teacherId))];
    if (!ids.length) return [];
    const now = new Date();
    const since = new Date(now.getTime() - ROSTER_LOOKBACK_DAYS * 86_400_000);

    const [users, enrollments, attendees, progress, reviews] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, fullName: true, country: true, timezone: true, studentProfile: { select: { dateOfBirth: true } } },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.enrollment.findMany({
        where: { teacherId, studentId: { in: ids } },
        select: { id: true, studentId: true, status: true, course: { select: { id: true, title: true } } },
      }),
      this.prisma.classAttendee.findMany({
        where: { studentId: { in: ids }, classSession: { teacherId, startsAt: { gte: since }, status: { not: 'CANCELLED' } } },
        select: { studentId: true, status: true, classSession: { select: { id: true, title: true, startsAt: true, status: true } } },
        orderBy: { classSession: { startsAt: 'asc' } },
      }),
      this.prisma.quranProgress.findMany({
        where: { studentId: { in: ids }, teacherId },
        orderBy: { recordedAt: 'desc' },
        distinct: ['studentId'],
        select: { studentId: true, type: true, surah: true, ayahFrom: true, ayahTo: true, qaidaLesson: true, recordedAt: true },
      }),
      this.prisma.homework.groupBy({ by: ['studentId'], where: { teacherId, status: 'SUBMITTED', studentId: { in: ids } }, _count: true }),
    ]);

    return users.map((u) => {
      const mine = attendees.filter((a) => a.studentId === u.id);
      const past = mine.filter((a) => a.classSession.startsAt < now && MARKED.includes(a.status));
      const next = mine.find((a) => a.classSession.startsAt >= now && ['SCHEDULED', 'LIVE'].includes(a.classSession.status));
      const last = [...past].reverse()[0];
      const p = progress.find((x) => x.studentId === u.id);
      const dob = u.studentProfile?.dateOfBirth;
      return {
        id: u.id,
        fullName: u.fullName,
        country: u.country,
        timezone: u.timezone,
        age: dob ? Math.floor((now.getTime() - dob.getTime()) / (365.25 * 86_400_000)) : null,
        courses: enrollments.filter((e) => e.studentId === u.id).map((e) => ({ enrollmentId: e.id, courseId: e.course.id, title: e.course.title, status: e.status })),
        nextClass: next ? { id: next.classSession.id, startsAt: next.classSession.startsAt.toISOString(), title: next.classSession.title } : null,
        lastClass: last ? { id: last.classSession.id, startsAt: last.classSession.startsAt.toISOString(), title: last.classSession.title, attendance: last.status } : null,
        attendancePercent: past.length ? Math.round((past.filter((a) => ATTENDED.includes(a.status)).length / past.length) * 100) : null,
        latestProgress: p ? { type: p.type, surah: p.surah, ayahFrom: p.ayahFrom, ayahTo: p.ayahTo, qaidaLesson: p.qaidaLesson, recordedAt: p.recordedAt.toISOString() } : null,
        homeworkAwaitingReview: reviews.find((r) => r.studentId === u.id)?._count ?? 0,
      };
    });
  }

  /** Courses the teacher can assign homework under for a student (their enrollments, else courses of shared classes). */
  async studentCourses(teacherId: string, studentId: string) {
    const [enr, cls] = await Promise.all([
      this.prisma.enrollment.findMany({ where: { teacherId, studentId }, select: { course: { select: { id: true, title: true } } } }),
      this.prisma.classSession.findMany({
        where: { teacherId, attendees: { some: { studentId } } },
        select: { course: { select: { id: true, title: true } } },
        distinct: ['courseId'],
      }),
    ]);
    const map = new Map([...enr, ...cls].map((x) => [x.course.id, x.course]));
    if (!map.size) throw new NotFoundException('You do not teach this student');
    return [...map.values()];
  }
}
