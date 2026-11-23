'use client';

import type { AuthUser, PermissionKey } from '@qa/shared-types';
import { create } from 'zustand';

interface AuthState {
  /** Kept in memory only — never in localStorage — so XSS cannot exfiltrate a long-lived credential. */
  accessToken: string | null;
  user: AuthUser | null;
  /** True once the initial silent refresh has completed (success or not). */
  ready: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
  markReady: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null }),
  markReady: () => set({ ready: true }),
}));

export function hasRole(user: AuthUser | null, ...roles: string[]) {
  return !!user && roles.some((r) => user.roles.includes(r));
}

export function can(user: AuthUser | null, permission: PermissionKey) {
  return !!user && (user.roles.includes('super-admin') || user.permissions.includes(permission));
}

/** Where a user should land after signing in. */
export function homeFor(user: AuthUser): string {
  const r = user.roles;
  if (r.some((x) => ['super-admin', 'academy-admin', 'branch-manager', 'accountant', 'support-staff'].includes(x))) return '/admin';
  if (r.includes('teacher')) return '/teacher';
  if (r.includes('parent')) return '/parent';
  return '/student';
}
