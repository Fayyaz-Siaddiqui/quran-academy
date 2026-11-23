/**
 * Platform-wide constants shared by the API and the web app.
 * Anything environment-specific belongs in .env, not here.
 */

export const APP_NAME = 'Quran Academy';

export const API_PREFIX = 'api/v1';

export const AUTH = {
  /** Access tokens are short lived and kept in memory on the client. */
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  /** Refresh tokens rotate on every use; a reused token revokes the whole session. */
  REFRESH_TOKEN_TTL_DAYS: 30,
  REFRESH_COOKIE_NAME: 'qa_rt',
  EMAIL_VERIFICATION_TTL_HOURS: 48,
  PASSWORD_RESET_TTL_MINUTES: 60,
  MAX_FAILED_LOGINS: 8,
  LOCKOUT_MINUTES: 15,
  PASSWORD_MIN_LENGTH: 10,
} as const;

export const UPLOADS = {
  MAX_DOCUMENT_BYTES: 10 * 1024 * 1024,
  MAX_AVATAR_BYTES: 3 * 1024 * 1024,
  ALLOWED_DOCUMENT_MIME: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_AVATAR_MIME: ['image/jpeg', 'image/png', 'image/webp'],
  SIGNED_URL_TTL_SECONDS: 15 * 60,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** Countries the academy actively markets to; any ISO country is still accepted. */
export const PRIMARY_MARKETS = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IE', name: 'Ireland' },
] as const;

export const SOCKET_EVENTS = {
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  CLASS_STATUS: 'class:status',
  ANNOUNCEMENT_NEW: 'announcement:new',
} as const;
