import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationTokenType } from '@prisma/client';
import { ParentOverview, SystemRole } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ChildDto } from '../auth/dto/auth.dto';
import { MailService } from '../mail/mail.service';
import { StudentsService } from '../students/students.service';
import { CLASS_SUMMARY_INCLUDE, ClassesService } from '../classes/classes.service';

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly students: StudentsService,
    private readonly classes: ClassesService,
    private readonly config: ConfigService,
  ) {}

  async children(parentId: string) {
    const links = await this.prisma.parentChild.findMany({
      where: { parentId, child: { deletedAt: null } },
      select: {
        relationship: true,
        child: {
          select: {
            id: true, fullName: true, email: true, status: true, timezone: true, preferredLanguage: true,
            studentProfile: { select: { dateOfBirth: true, preferredClassTiming: true, level: true, preferredCourse: { select: { title: true, slug: true } } } },
            studentEnrollments: { where: { status: { in: ['ACTIVE', 'PENDING'] } }, select: { status: true, course: { select: { title: true } }, teacher: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((l) => ({ ...l.child, relationship: l.relationship, hasLogin: !!l.child.email }));
  }

  async addChild(parentId: string, dto: ChildDto) {
    const parent = await this.prisma.user.findUniqueOrThrow({ where: { id: parentId } });
    if (!parent.academyId) throw new BadRequestException('Parent is not attached to an academy');
    const count = await this.prisma.parentChild.count({ where: { parentId } });
    if (count >= 15) throw new BadRequestException('Maximum number of children reached');
    if (dto.email) {
      const taken = await this.prisma.user.count({ where: { email: dto.email } });
      if (taken) throw new ConflictException('This email is already in use');
    }
    const roleId = await this.auth.roleId(SystemRole.STUDENT);
    const child = await this.prisma.$transaction((tx) => this.auth.createChild(tx, parent.academyId!, parent, dto, roleId));
    if (parent.email) {
      await this.mail.send({
        to: parent.email,
        template: 'child-account-created',
        data: { parentName: parent.fullName, childName: child.fullName, url: `${this.config.get('APP_URL')}/parent` },
      });
    }
    return { id: child.id, fullName: child.fullName };
  }

  async updateChild(parentId: string, childId: string, dto: Partial<Pick<ChildDto, 'fullName' | 'preferredLanguage' | 'preferredClassTiming'>>) {
    await this.assertParentOf(parentId, childId);
    await this.prisma.user.update({
      where: { id: childId },
      data: {
        fullName: dto.fullName,
        preferredLanguage: dto.preferredLanguage,
        studentProfile: dto.preferredClassTiming ? { update: { preferredClassTiming: dto.preferredClassTiming } } : undefined,
      },
    });
    return (await this.children(parentId)).find((c) => c.id === childId);
  }

  /** Gives an older child their own login by emailing a set-password link. */
  async enableChildLogin(parentId: string, childId: string, email: string) {
    await this.assertParentOf(parentId, childId);
    const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== childId) throw new ConflictException('This email is already in use');
    const child = await this.prisma.user.update({ where: { id: childId }, data: { email } });
    const token = await this.auth.createVerificationToken(childId, VerificationTokenType.PASSWORD_RESET, 72 * 60);
    await this.mail.send({
      to: email,
      template: 'reset-password',
      data: { name: child.fullName, url: `${this.config.get('APP_URL')}/reset-password?token=${token}&welcome=1` },
    });
    return { ok: true };
  }

  async childDashboard(parentId: string, childId: string) {
    await this.assertParentOf(parentId, childId);
    return this.students.dashboard(childId);
  }

  /** One screen for the whole family: per-child status plus everyone's classes this week. */
  async overview(parentId: string): Promise<ParentOverview> {
    const parent = await this.prisma.user.findUniqueOrThrow({ where: { id: parentId }, select: { id: true, fullName: true, timezone: true, academyId: true } });
    const links = await this.prisma.parentChild.findMany({
      where: { parentId, child: { deletedAt: null } },
      select: { child: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ids = links.map((l) => l.child.id);
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86_400_000);

    const [enrollments, attendance, homework, progress, upcoming, announcements] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { studentId: { in: ids }, status: { in: ['ACTIVE', 'PAUSED'] } },
        select: { studentId: true, course: { select: { title: true } }, teacher: { select: { fullName: true } } },
      }),
      this.prisma.classAttendee.groupBy({
        by: ['studentId', 'status'],
        where: { studentId: { in: ids }, status: { in: ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] } },
        _count: true,
      }),
      this.prisma.homework.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, status: { in: ['ASSIGNED', 'OVERDUE'] } }, _count: true }),
      this.prisma.quranProgress.findMany({
        where: { studentId: { in: ids } }, orderBy: { recordedAt: 'desc' }, distinct: ['studentId'],
        select: { studentId: true, type: true, surah: true, ayahFrom: true, ayahTo: true, qaidaLesson: true, rating: true, recordedAt: true },
      }),
      this.prisma.classSession.findMany({
        where: { attendees: { some: { studentId: { in: ids } } }, status: { in: ['SCHEDULED', 'LIVE'] }, endsAt: { gte: now }, startsAt: { lt: week } },
        include: CLASS_SUMMARY_INCLUDE,
        orderBy: { startsAt: 'asc' },
        take: 50,
      }),
      parent.academyId
        ? this.prisma.announcement.findMany({
            where: {
              academyId: parent.academyId, publishedAt: { lte: now },
              AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: [{ audience: { isEmpty: true } }, { audience: { has: 'parent' } }] }],
            },
            orderBy: { publishedAt: 'desc' }, take: 3,
          })
        : Promise.resolve([]),
    ]);

    // A class may include two siblings; list it once per child.
    const tagged = upcoming.flatMap((c) =>
      c.attendees.filter((a) => ids.includes(a.studentId)).map((a) => ({
        ...this.classes.toSummary(c, a.studentId),
        child: { id: a.studentId, fullName: links.find((l) => l.child.id === a.studentId)!.child.fullName },
      })),
    );

    return {
      parent: { id: parent.id, fullName: parent.fullName, timezone: parent.timezone },
      children: links.map(({ child }) => {
        const enr = enrollments.filter((e) => e.studentId === child.id);
        const att = attendance.filter((a) => a.studentId === child.id);
        const marked = att.reduce((n, a) => n + a._count, 0);
        const attended = att.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').reduce((n, a) => n + a._count, 0);
        const next = tagged.find((c) => c.child.id === child.id);
        const p = progress.find((x) => x.studentId === child.id);
        return {
          id: child.id,
          fullName: child.fullName,
          hasLogin: !!child.email,
          enrolled: enr.length > 0,
          courses: enr.map((e) => e.course.title),
          teacherName: enr.find((e) => e.teacher)?.teacher?.fullName ?? null,
          nextClass: next ? { id: next.id, startsAt: next.startsAt, title: next.title, canJoin: next.canJoin, status: next.status } : null,
          attendancePercent: marked ? Math.round((attended / marked) * 100) : null,
          pendingHomework: homework.find((h) => h.studentId === child.id)?._count ?? 0,
          latestProgress: p ? { ...p, recordedAt: p.recordedAt.toISOString() } : null,
        };
      }),
      upcomingClasses: tagged,
      announcements: announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, publishedAt: a.publishedAt.toISOString() })),
    };
  }

  async assertParentOf(parentId: string, childId: string) {
    const link = await this.prisma.parentChild.findUnique({ where: { parentId_childId: { parentId, childId } } });
    if (!link) throw new NotFoundException('Child not found');
  }
}
