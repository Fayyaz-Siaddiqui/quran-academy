'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export const errMsg = (e: unknown, fallback = 'Something went wrong') => (e instanceof ApiError ? e.message : fallback);

/**
 * Empty strings from inputs become null: optional API fields accept null (skipping
 * format checks such as URL), and on PATCH null clears a previously set value.
 */
export function blankToNull<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v])) as T;
}

/** Purges the public site's CMS cache so edits are live immediately. Failure is non-fatal (ISR refreshes within 5 min). */
export async function refreshPublicSite() {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;
  await fetch('/api/revalidate', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
}

/**
 * Mutation wrapper for every CMS write: toast, invalidate the admin list, and
 * refresh the public website.
 */
export function useCmsMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { queryKey: unknown[]; success: string | ((v: TVars) => string); onSuccess?: (r: TResult, v: TVars) => void },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, v) => {
      toast.success(typeof opts.success === 'function' ? opts.success(v) : opts.success);
      await qc.invalidateQueries({ queryKey: opts.queryKey });
      opts.onSuccess?.(r, v);
      void refreshPublicSite();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/** Up/down reordering for lists with a `sortOrder` field. Returns the two rows to persist. */
export function swapOrder<T extends { id: string; sortOrder: number }>(items: T[], index: number, dir: -1 | 1): [T, T] | null {
  const other = items[index + dir];
  const current = items[index];
  if (!other || !current) return null;
  // Normalise when sort orders collide so a swap always changes position.
  const a = current.sortOrder === other.sortOrder ? index : current.sortOrder;
  const b = current.sortOrder === other.sortOrder ? index + dir : other.sortOrder;
  return [{ ...current, sortOrder: b }, { ...other, sortOrder: a }];
}

export function CharCount({ value, max }: { value?: string | null; max: number }) {
  const n = value?.length ?? 0;
  return <span className={n > max ? 'text-destructive' : 'text-muted-foreground'}>{n}/{max}</span>;
}
