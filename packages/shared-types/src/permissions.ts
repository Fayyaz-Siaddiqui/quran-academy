import { SystemRole, SystemRoleSlug } from './roles';

/**
 * Permission catalogue. Keys are `<module>.<action>`.
 * The backend enforces these with @RequirePermissions(); the frontend only
 * uses them to hide UI that the API would refuse anyway.
 */
export const PERMISSIONS = {
  // Users & access
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_SUSPEND: 'users.suspend',
  USERS_ACTIVITY: 'users.activity',
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
  AUDIT_READ: 'audit.read',

  // Tenancy
  ACADEMIES_MANAGE: 'academies.manage',
  BRANCHES_READ: 'branches.read',
  BRANCHES_MANAGE: 'branches.manage',

  // People
  TEACHERS_READ: 'teachers.read',
  TEACHERS_APPROVE: 'teachers.approve',
  TEACHERS_MANAGE: 'teachers.manage',
  STUDENTS_READ: 'students.read',
  STUDENTS_MANAGE: 'students.manage',
  PARENTS_READ: 'parents.read',
  PARENTS_MANAGE: 'parents.manage',

  // Learning
  COURSES_READ: 'courses.read',
  COURSES_MANAGE: 'courses.manage',
  ENROLLMENTS_MANAGE: 'enrollments.manage',
  CLASSES_READ: 'classes.read',
  CLASSES_MANAGE: 'classes.manage',
  CLASSES_TEACH: 'classes.teach',
  ATTENDANCE_MARK: 'attendance.mark',
  RECORDINGS_READ: 'recordings.read',
  RECORDINGS_MANAGE: 'recordings.manage',
  HOMEWORK_ASSIGN: 'homework.assign',
  HOMEWORK_REVIEW: 'homework.review',
  PROGRESS_RECORD: 'progress.record',

  // Communication
  ANNOUNCEMENTS_MANAGE: 'announcements.manage',
  NOTIFICATIONS_SEND: 'notifications.send',

  // Website / CMS
  CMS_MANAGE: 'cms.manage',
  LEADS_READ: 'leads.read',
  LEADS_MANAGE: 'leads.manage',

  // Finance (modules arrive in a later phase; permission exists now so roles are stable)
  FINANCE_READ: 'finance.read',
  FINANCE_MANAGE: 'finance.manage',

  // Settings
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'users.read': 'View user accounts',
  'users.create': 'Create user accounts',
  'users.update': 'Edit user accounts',
  'users.delete': 'Delete user accounts',
  'users.suspend': 'Activate, deactivate and suspend accounts',
  'users.activity': 'Review login and account activity',
  'roles.read': 'View roles and permissions',
  'roles.manage': 'Create, edit and delete roles; assign permissions',
  'audit.read': 'View the audit log',
  'academies.manage': 'Create and manage academies (tenants)',
  'branches.read': 'View branches',
  'branches.manage': 'Create and manage branches',
  'teachers.read': 'View teacher profiles',
  'teachers.approve': 'Approve or reject teacher applications',
  'teachers.manage': 'Edit teachers and assignments',
  'students.read': 'View students',
  'students.manage': 'Edit students and assignments',
  'parents.read': 'View parents / guardians',
  'parents.manage': 'Edit parents and child links',
  'courses.read': 'View courses',
  'courses.manage': 'Create and edit courses and lessons',
  'enrollments.manage': 'Enroll students and assign teachers',
  'classes.read': 'View class schedules',
  'classes.manage': 'Schedule, reschedule and cancel classes',
  'classes.teach': 'Start and conduct live classes',
  'attendance.mark': 'Mark class attendance',
  'recordings.read': 'View all recordings',
  'recordings.manage': 'Manage and delete recordings',
  'homework.assign': 'Assign homework',
  'homework.review': 'Review and grade homework',
  'progress.record': 'Record Quran learning progress',
  'announcements.manage': 'Publish announcements',
  'notifications.send': 'Send notifications to users',
  'cms.manage': 'Edit public website content',
  'leads.read': 'View trial bookings and contact messages',
  'leads.manage': 'Process trial bookings and contact messages',
  'finance.read': 'View invoices and payments',
  'finance.manage': 'Manage invoices, payments and refunds',
  'settings.manage': 'Manage academy settings',
};

const P = PERMISSIONS;

/**
 * Default permission sets per system role. Applied by the seeder.
 * Students and parents act mostly on their own data; ownership is enforced in
 * services, so they need few catalogue permissions.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleSlug, PermissionKey[]> = {
  [SystemRole.SUPER_ADMIN]: ALL_PERMISSIONS,
  [SystemRole.ACADEMY_ADMIN]: ALL_PERMISSIONS.filter((p) => p !== P.ACADEMIES_MANAGE),
  [SystemRole.BRANCH_MANAGER]: [
    P.USERS_READ, P.USERS_UPDATE, P.USERS_SUSPEND, P.USERS_ACTIVITY,
    P.BRANCHES_READ,
    P.TEACHERS_READ, P.TEACHERS_APPROVE, P.TEACHERS_MANAGE,
    P.STUDENTS_READ, P.STUDENTS_MANAGE, P.PARENTS_READ, P.PARENTS_MANAGE,
    P.COURSES_READ, P.ENROLLMENTS_MANAGE,
    P.CLASSES_READ, P.CLASSES_MANAGE, P.ATTENDANCE_MARK,
    P.RECORDINGS_READ, P.ANNOUNCEMENTS_MANAGE, P.NOTIFICATIONS_SEND,
    P.LEADS_READ, P.LEADS_MANAGE,
  ],
  [SystemRole.TEACHER]: [
    P.COURSES_READ, P.CLASSES_READ, P.CLASSES_TEACH, P.ATTENDANCE_MARK,
    P.HOMEWORK_ASSIGN, P.HOMEWORK_REVIEW, P.PROGRESS_RECORD,
  ],
  [SystemRole.STUDENT]: [P.COURSES_READ],
  [SystemRole.PARENT]: [P.COURSES_READ],
  [SystemRole.ACCOUNTANT]: [P.USERS_READ, P.STUDENTS_READ, P.PARENTS_READ, P.FINANCE_READ, P.FINANCE_MANAGE],
  [SystemRole.SUPPORT_STAFF]: [
    P.USERS_READ, P.USERS_ACTIVITY, P.STUDENTS_READ, P.PARENTS_READ, P.TEACHERS_READ,
    P.CLASSES_READ, P.COURSES_READ, P.LEADS_READ, P.LEADS_MANAGE,
  ],
};
