import { Injectable, NotFoundException } from '@nestjs/common';
import { StudentDashboard } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CLASS_SUMMARY_INCLUDE, ClassesService } from '../classes/classes.service';
import { dayBounds } from '../../common/utils/time';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly storage: StorageService,
  ) {}

  async dashboard(studentId: string): Promise<StudentDashboard> {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, timezone: true, academyId: true, roles: { select: { role: { select: { slug: true } } } }, studentProfile: { select: { assignedTeacherId: true } } },
    });
    if (!student) throw new NotFoundException();
    const now = new Date();
    const { start, end } = dayBounds(student.timezone, now);

    const [
      upcoming,
      today,
      enrollments,
      attendance,
      homework,
      recordings,
      progress,
      notifications,
      announcements,
      teacher,
    ] = await Promise.all([
      this.prisma.classSession.findMany({
        where: { attendees: { some: { studentId } }, status: { in: ['SCHEDULED', 'LIVE'] }, endsAt: { gte: now } },
        include: CLASS_SUMMARY_INCLUDE,
        orderBy: { startsAt: 'asc' },
        take: 6,
      }),
      this.prisma.classSession.findMany({
        where: { attendees: { some: { studentId } }, startsAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
        include: CLASS_SUMMARY_INCLUDE,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.enrollment.findMany({
        where: { studentId, status: 'ACTIVE' },
        include: {
          course: { select: { id: true, title: true, slug: true, _count: { select: { lessons: true } } } },
          teacher: { select: { fullName: true } },
          _count: { select: { lessonProgress: true } },
        },
      }),
      this.prisma.classAttendee.groupBy({
        by: ['status'],
        where: { studentId, classSession: { status: { in: ['COMPLETED', 'MISSED'] } } },
        _count: true,
      }),
      this.prisma.homework.findMany({
        where: { studentId, status: { in: ['ASSIGNED', 'OVERDUE', 'SUBMITTED'] } },
        include: { course: { select: { title: true } } },
        orderBy: { dueAt: 'asc' },
        take: 6,
      }),
      this.prisma.recording.findMany({
        where: { status: 'AVAILABLE', classSession: { attendees: { some: { studentId } } } },
        select: { id: true, title: true, recordedAt: true, durationSeconds: true },
        orderBy: { recordedAt: 'desc' },
        take: 4,
      }),
      this.prisma.quranProgress.findMany({ where: { studentId }, orderBy: { recordedAt: 'desc' }, take: 5 }),
      this.prisma.notification.findMany({ where: { userId: studentId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      student.academyId
        ? this.prisma.announcement.findMany({
            where: {
              academyId: student.academyId,
              publishedAt: { lte: now },
              AND: [
                { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                { OR: [{ audience: { isEmpty: true } }, { audience: { hasSome: student.roles.map((r) => r.role.slug) } }] },
              ],
            },
            orderBy: { publishedAt: 'desc' },
            take: 3,
          })
        : Promise.resolve([]),
      student.studentProfile?.assignedTeacherId
        ? this.prisma.user.findUnique({
            where: { id: student.studentProfile.assignedTeacherId },
            select: { id: true, fullName: true, avatarKey: true, teacherProfile: { select: { languages: true } } },
          })
        : Promise.resolve(null),
    ]);

    const count = (s: string) => attendance.find((a) => a.status === s)?._count ?? 0;
    const attended = count('PRESENT') + count('LATE');
    const heldTotal = attended + count('ABSENT');
    const pendingHomework = await this.prisma.homework.count({ where: { studentId, status: { in: ['ASSIGNED', 'OVERDUE'] } } });

    const activeCourses = enrollments.map((e) => {
      const total = e.course._count.lessons;
      return {
        enrollmentId: e.id,
        courseId: e.course.id,
        title: e.course.title,
        slug: e.course.slug,
        teacherName: e.teacher?.fullName ?? null,
        progressPercent: total ? Math.round((e._count.lessonProgress / total) * 100) : 0,
      };
    });
    const overall = activeCourses.length
      ? Math.round(activeCourses.reduce((n, c) => n + c.progressPercent, 0) / activeCourses.length)
      : 0;

    return {
      student: { id: student.id, fullName: student.fullName, timezone: student.timezone },
      assignedTeacher: teacher
        ? {
            id: teacher.id,
            fullName: teacher.fullName,
            avatarUrl: teacher.avatarKey && this.storage.enabled ? (await this.storage.presignDownload(teacher.avatarKey)).url : null,
            languages: teacher.teacherProfile?.languages ?? [],
          }
        : null,
      upcomingClasses: upcoming.map((c) => this.classes.toSummary(c, studentId)),
      todaysClasses: today.map((c) => this.classes.toSummary(c, studentId)),
      activeCourses,
      stats: {
        completedClasses: attended,
        attendancePercent: heldTotal ? Math.round((attended / heldTotal) * 100) : 100,
        pendingHomework,
        overallProgressPercent: overall,
      },
      homework: homework.map((h) => ({
        id: h.id,
        title: h.title,
        dueAt: h.dueAt?.toISOString() ?? null,
        status: h.dueAt && h.dueAt < now && h.status === 'ASSIGNED' ? 'OVERDUE' : h.status,
        courseTitle: h.course.title,
      })),
      recentRecordings: recordings.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() })),
      recentProgress: progress.map((p) => ({
        id: p.id, type: p.type, surah: p.surah, ayahFrom: p.ayahFrom, ayahTo: p.ayahTo, rating: p.rating, recordedAt: p.recordedAt.toISOString(),
      })),
      notifications: notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null })),
      announcements: announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, publishedAt: a.publishedAt.toISOString() })),
    };
  }

  async profile(studentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true, fullName: true, email: true, phone: true, country: true, timezone: true, preferredLanguage: true, createdAt: true,
        studentProfile: {
          select: {
            dateOfBirth: true, preferredClassTiming: true, level: true,
            guardianName: true, guardianEmail: true, guardianPhone: true, guardianRelationship: true,
            preferredCourse: { select: { title: true, slug: true } },
          },
        },
        childLinks: { select: { parent: { select: { id: true, fullName: true, email: true, phone: true } } } },
      },
    });
    if (!user) throw new NotFoundException();
    const teacherId = (await this.prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { assignedTeacherId: true } }))?.assignedTeacherId;
    const teacher = teacherId
      ? await this.prisma.user.findUnique({
          where: { id: teacherId },
          select: { id: true, fullName: true, country: true, teacherProfile: { select: { bio: true, languages: true, experienceYears: true, certifications: true } } },
        })
      : null;
    return { ...user, parents: user.childLinks.map((l) => l.parent), childLinks: undefined, assignedTeacher: teacher };
  }
}
