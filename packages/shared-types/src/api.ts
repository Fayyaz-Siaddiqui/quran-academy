import type { PermissionKey } from './permissions';
import type { SystemRoleSlug, UserStatus } from './roles';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: UserStatus;
  timezone: string;
  country: string | null;
  academyId: string | null;
  branchId: string | null;
  roles: (SystemRoleSlug | string)[];
  permissions: PermissionKey[];
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  challengeToken: string;
}

export type LoginResponse = AuthTokensResponse | TwoFactorChallengeResponse;

export type ClassStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'MISSED';
export type AttendanceStatus = 'SCHEDULED' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type HomeworkStatus = 'ASSIGNED' | 'SUBMITTED' | 'REVIEWED' | 'OVERDUE';

export interface ClassSessionSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: ClassStatus;
  course: { id: string; title: string; slug: string };
  teacher: { id: string; fullName: string; avatarUrl: string | null };
  attendanceStatus?: AttendanceStatus;
  canJoin: boolean;
}

export interface StudentDashboard {
  student: { id: string; fullName: string; timezone: string };
  assignedTeacher: { id: string; fullName: string; avatarUrl: string | null; languages: string[] } | null;
  upcomingClasses: ClassSessionSummary[];
  todaysClasses: ClassSessionSummary[];
  activeCourses: { enrollmentId: string; courseId: string; title: string; slug: string; progressPercent: number; teacherName: string | null }[];
  stats: {
    completedClasses: number;
    attendancePercent: number;
    pendingHomework: number;
    overallProgressPercent: number;
  };
  homework: { id: string; title: string; dueAt: string | null; status: HomeworkStatus; courseTitle: string }[];
  recentRecordings: { id: string; title: string; recordedAt: string; durationSeconds: number | null }[];
  recentProgress: { id: string; type: string; surah: number; ayahFrom: number; ayahTo: number; rating: number | null; recordedAt: string }[];
  notifications: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[];
  announcements: { id: string; title: string; body: string; publishedAt: string }[];
}

export interface TeacherDashboard {
  teacher: { id: string; fullName: string; timezone: string };
  todaysClasses: ClassSessionSummary[];
  upcomingClasses: ClassSessionSummary[];
  /** Completed in the last 7 days without class notes — a prompt to write notes / record progress. */
  classesAwaitingNotes: ClassSessionSummary[];
  pendingReviews: { id: string; title: string; studentId: string; studentName: string; courseTitle: string; submittedAt: string }[];
  stats: {
    activeStudents: number;
    classesThisMonth: number;
    hoursThisMonth: number;
    /** Present or late ÷ all marked attendances over the last 30 days. */
    attendanceRate30d: number;
    pendingReviewCount: number;
  };
}

export interface TeacherStudent {
  id: string;
  fullName: string;
  country: string | null;
  timezone: string;
  age: number | null;
  courses: { enrollmentId: string; courseId: string; title: string; status: string }[];
  nextClass: { id: string; startsAt: string; title: string } | null;
  lastClass: { id: string; startsAt: string; title: string; attendance: AttendanceStatus } | null;
  attendancePercent: number | null;
  latestProgress: { type: string; surah: number; ayahFrom: number; ayahTo: number; qaidaLesson: number | null; recordedAt: string } | null;
  homeworkAwaitingReview: number;
}

export interface AdminOverview {
  generatedAt: string;
  timezone: string;
  kpis: {
    activeStudents: number;
    activeTeachers: number;
    classesToday: number;
    liveNow: number;
    attendanceRate30d: number;
    completedThisMonth: number;
    teachingHoursThisMonth: number;
  };
  /** Items that need someone to act. */
  actions: {
    pendingTeacherApprovals: number;
    newTrialBookings: number;
    newContactMessages: number;
    studentsAwaitingEnrollment: number;
    homeworkAwaitingReview: number;
  };
  /** Weekly new student registrations, oldest first. `weekStart` is YYYY-MM-DD in `timezone`. */
  signupsByWeek: { weekStart: string; count: number }[];
  /** Scheduled classes per day for the next 7 days. */
  classesNext7Days: { date: string; count: number }[];
  todaysClasses: (ClassSessionSummary & { attendees: { studentId: string; fullName: string; status: AttendanceStatus }[] })[];
  recentSignups: { id: string; fullName: string; role: string; status: string; country: string | null; createdAt: string }[];
}

export interface EnrollmentRow {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string | null;
  createdAt: string;
  student: { id: string; fullName: string; email: string | null; country: string | null; timezone: string };
  course: { id: string; title: string };
  teacher: { id: string; fullName: string } | null;
}

export interface ParentOverview {
  parent: { id: string; fullName: string; timezone: string };
  children: {
    id: string;
    fullName: string;
    hasLogin: boolean;
    enrolled: boolean;
    courses: string[];
    teacherName: string | null;
    nextClass: { id: string; startsAt: string; title: string; canJoin: boolean; status: ClassStatus } | null;
    attendancePercent: number | null;
    pendingHomework: number;
    latestProgress: { type: string; surah: number; ayahFrom: number; ayahTo: number; qaidaLesson: number | null; rating: number | null; recordedAt: string } | null;
  }[];
  /** All children's classes in the next 7 days, each tagged with the child. */
  upcomingClasses: (ClassSessionSummary & { child: { id: string; fullName: string } })[];
  announcements: { id: string; title: string; body: string; publishedAt: string }[];
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}
