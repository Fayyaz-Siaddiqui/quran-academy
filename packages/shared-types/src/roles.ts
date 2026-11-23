/**
 * System roles. These are seeded per platform and cannot be deleted.
 * Admins may create additional custom roles with any permission subset.
 */
export const SystemRole = {
  SUPER_ADMIN: 'super-admin',
  ACADEMY_ADMIN: 'academy-admin',
  BRANCH_MANAGER: 'branch-manager',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
  ACCOUNTANT: 'accountant',
  SUPPORT_STAFF: 'support-staff',
} as const;

export type SystemRoleSlug = (typeof SystemRole)[keyof typeof SystemRole];

export const SYSTEM_ROLE_LABELS: Record<SystemRoleSlug, string> = {
  'super-admin': 'Super Admin',
  'academy-admin': 'Academy Admin',
  'branch-manager': 'Branch Manager',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent / Guardian',
  accountant: 'Accountant',
  'support-staff': 'Support Staff',
};

/** Roles whose users land in the administration area after login. */
export const STAFF_ROLES: SystemRoleSlug[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ACADEMY_ADMIN,
  SystemRole.BRANCH_MANAGER,
  SystemRole.ACCOUNTANT,
  SystemRole.SUPPORT_STAFF,
];

export const UserStatus = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const TeacherApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type TeacherApprovalStatus = (typeof TeacherApprovalStatus)[keyof typeof TeacherApprovalStatus];
