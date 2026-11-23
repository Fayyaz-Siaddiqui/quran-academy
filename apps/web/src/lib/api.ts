'use client';

import type { AuthTokensResponse } from '@qa/shared-types';
import { useAuthStore } from './auth-store';

// Unset in a production build = same-origin: /api/v1 and /socket.io are proxied by Next (API_PROXY_TARGET).
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000')
).replace(/\/$/, '');
export const API_BASE = `${API_URL}/api/v1`;
const ACADEMY = process.env.NEXT_PUBLIC_ACADEMY_SLUG;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Single-flight:
 * concurrent 401s share one refresh so the rotating token is not reused
 * (which the API would treat as theft and revoke the session).
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: ACADEMY ? { 'X-Academy': ACADEMY } : undefined,
      });
      if (!res.ok) {
        useAuthStore.getState().clear();
        return false;
      }
      const data = (await res.json()) as AuthTokensResponse;
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown; auth?: boolean };

export async function api<T>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(ACADEMY ? { 'X-Academy': ACADEMY } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !retried && !path.startsWith('/auth/login')) {
    if (await refreshSession()) return api<T>(path, opts, true);
  }

  if (!res.ok) {
    let payload: { message?: string | string[]; code?: string } = {};
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error */
    }
    const message = Array.isArray(payload.message) ? payload.message[0] : payload.message;
    throw new ApiError(res.status, message ?? `Request failed (${res.status})`, payload.code, payload);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Uploads a file straight to private storage via a presigned URL. */
export async function uploadToPresignedUrl(url: string, file: File) {
  const res = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!res.ok) throw new ApiError(res.status, 'Upload failed');
}
