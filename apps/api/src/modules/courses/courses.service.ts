import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@qa/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCourseDto, EnrollDto, LessonDto, UpdateCourseDto, UpdateEnrollmentDto } from './courses.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───── Public catalogue ─────

  publicList(academyId: string) {
    return this.prisma.course.findMany({
      where: { academyId, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true, slug: true, title: true, category: true, level: true, shortDescription: true, ageGroup: true,
        durationWeeks: true, classMinutes: true, imageUrl: true,
      },
    });
  }

  async publicGet(academyId: string, slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { academyId, slug, isPublished: true },
      include: { lessons: { select: { id: true, title: true, summary: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  // ───── Administration ─────

  adminList(academyId: string) {
    return this.prisma.course.findMany({
      where: { academyId },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: { _count: { select: { enrollments: true, lessons: true } } },
    });
  }

  async adminGet(academyId: string, id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, academyId },
      include: { lessons: { orderBy: { sortOrder: 'asc' } }, _count: { select: { enrollments: true } } },
    });
    if (!course) throw new NotFoundException();
    return course;
  }

  create(academyId: string, dto: CreateCourseDto) {
    return this.prisma.course.create({ data: { ...dto, academyId, outcomes: dto.outcomes ?? [] } });
  }

  async update(academyId: string, id: string, dto: UpdateCourseDto) {
    await this.find(academyId, id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async remove(academyId: string, id: string) {
    await this.find(academyId, id);
    const used = await this.prisma.classSession.count({ where: { courseId: id } });
    if (used) throw new BadRequestException('Course has classes. Unpublish it instead of deleting.');
    await this.prisma.course.delete({ where: { id } });
    return { id };
  }

  async upsertLesson(academyId: string, courseId: string, dto: LessonDto, lessonId?: string) {
    await this.find(academyId, courseId);
    if (lessonId) {
      const { count } = await this.prisma.courseLesson.updateMany({ where: { id: lessonId, courseId }, data: dto });
      if (!count) throw new NotFoundException();
      return this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    }
    return this.prisma.courseLesson.create({ data: { ...dto, courseId } });
  }

  async removeLesson(academyId: string, courseId: string, lessonId: string) {
    await this.find(academyId, courseId);
    const { count } = await this.prisma.courseLesson.deleteMany({ where: { id: lessonId, courseId } });
    if (!count) throw new NotFoundException();
    return { id: lessonId };
  }

  // ───── Enrollments ─────

  async enroll(academyId: string, dto: EnrollDto) {
    const [student, course, teacher] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: dto.studentId, academyId, roles: { some: { role: { slug: SystemRole.STUDENT } } } }, include: { studentProfile: true } }),
      this.prisma.course.findFirst({ where: { id: dto.courseId, academyId } }),
      dto.teacherId
        ? this.prisma.user.findFirst({ where: { id: dto.teacherId, academyId, status: 'ACTIVE', teacherProfile: { approvalStatus: 'APPROVED' } } })
        : Promise.resolve(null),
    ]);
    if (!student) throw new BadRequestException('Student not found');
    if (!course) throw new BadRequestException('Course not found');
    if (dto.teacherId && !teacher) throw new BadRequestException('Teacher not found or not approved');

    const enrollment = await this.prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      create: { studentId: student.id, courseId: course.id, teacherId: teacher?.id, status: 'ACTIVE', startedAt: new Date() },
      update: { teacherId: teacher?.id, status: 'ACTIVE' },
    });
    if (teacher && student.studentProfile && !student.studentProfile.assignedTeacherId) {
      await this.prisma.studentProfile.update({ where: { userId: student.id }, data: { assignedTeacherId: teacher.id } });
    }
    await this.notifications.notify(student.id, {
      type: 'enrollment.created',
      title: 'You have been enrolled',
      body: `You are now enrolled in ${course.title}${teacher ? ` with ${teacher.fullName}` : ''}.`,
      data: { enrollmentId: enrollment.id },
    });
    if (teacher) {
      await this.notifications.notify(teacher.id, {
        type: 'enrollment.assigned',
        title: 'New student assigned',
        body: `${student.fullName} has been assigned to you for ${course.title}.`,
        data: { enrollmentId: enrollment.id, studentId: student.id },
      });
    }
    return enrollment;
  }

  async updateEnrollment(academyId: string, id: string, dto: UpdateEnrollmentDto) {
    const e = await this.prisma.enrollment.findFirst({ where: { id, course: { academyId } } });
    if (!e) throw new NotFoundException();
    if (dto.teacherId) {
      const ok = await this.prisma.user.count({ where: { id: dto.teacherId, academyId, teacherProfile: { approvalStatus: 'APPROVED' } } });
      if (!ok) throw new BadRequestException('Teacher not found or not approved');
    }
    return this.prisma.enrollment.update({
      where: { id },
      data: { ...dto, completedAt: dto.status === 'COMPLETED' ? new Date() : undefined },
    });
  }

  // ───── Student self-service ─────

  /** Enrollments with lesson completion. Used by students and (for their children) parents. */
  async studentCourses(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, status: { in: ['ACTIVE', 'PAUSED', 'COMPLETED', 'PENDING'] } },
      include: {
        course: { include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, summary: true, sortOrder: true } } } },
        teacher: { select: { id: true, fullName: true } },
        lessonProgress: { select: { lessonId: true, completedAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return enrollments.map((e) => {
      const done = new Map(e.lessonProgress.map((p) => [p.lessonId, p.completedAt]));
      const total = e.course.lessons.length;
      return {
        enrollmentId: e.id,
        status: e.status,
        teacher: e.teacher,
        course: { id: e.course.id, slug: e.course.slug, title: e.course.title, category: e.course.category, level: e.course.level },
        progressPercent: total ? Math.round((done.size / total) * 100) : 0,
        lessons: e.course.lessons.map((l) => ({ ...l, completedAt: done.get(l.id) ?? null })),
      };
    });
  }

  async lesson(auth: AuthContext, lessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException();
    const enrolled = await this.prisma.enrollment.count({ where: { studentId: auth.userId, courseId: lesson.courseId } });
    if (!enrolled) throw new NotFoundException();
    return lesson;
  }

  async completeLesson(studentId: string, lessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException();
    const enrollment = await this.prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId: lesson.courseId } } });
    if (!enrollment || enrollment.status !== 'ACTIVE') throw new NotFoundException('You are not actively enrolled in this course');
    await this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
      create: { enrollmentId: enrollment.id, lessonId },
      update: {},
    });
    return { lessonId, completed: true };
  }

  private async find(academyId: string, id: string) {
    const c = await this.prisma.course.findFirst({ where: { id, academyId } });
    if (!c) throw new NotFoundException();
    return c;
  }
}
