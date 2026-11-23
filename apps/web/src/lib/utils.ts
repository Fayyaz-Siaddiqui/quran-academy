import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(minorUnits: number, currency = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: minorUnits % 100 ? 2 : 0 }).format(minorUnits / 100);
}

/** Formats a UTC instant in the viewer's chosen IANA timezone. */
export function formatDateTime(iso: string | Date, timeZone?: string, opts: Intl.DateTimeFormatOptions = {}) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone, ...opts,
  }).format(d);
}

export function formatTime(iso: string | Date, timeZone?: string) {
  return formatDateTime(iso, timeZone, { weekday: undefined, day: undefined, month: undefined });
}

export function formatDate(iso: string | Date, timeZone?: string) {
  return formatDateTime(iso, timeZone, { hour: undefined, minute: undefined, year: 'numeric' });
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return '—';
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Karachi', 'Australia/Sydney'];
  }
})();
