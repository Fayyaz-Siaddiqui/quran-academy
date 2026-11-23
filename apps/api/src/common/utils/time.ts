/**
 * Calendar helpers for IANA time zones.
 *
 * Never add or subtract multiples of 24 h to move between local days: on DST
 * transitions a local day is 23 or 25 hours long, so "midnight − 7 × 24 h" can
 * land at 23:00 on the wrong date. Instead do date arithmetic on the calendar
 * (Y-M-D) and resolve each local midnight to a UTC instant.
 */

export type YMD = { y: number; m: number; d: number };

/** Offset of `timeZone` from UTC at `instant`, in ms (e.g. +4 h for Asia/Dubai). */
function offsetMs(timeZone: string, instant: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Calendar date of `instant` in `timeZone`. */
export function localDate(timeZone: string, instant = new Date()): YMD {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(instant).split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

/** Calendar arithmetic (handles month/year rollover). */
export function addDays({ y, m, d }: YMD, days: number): YMD {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export const ymdString = ({ y, m, d }: YMD) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** 0 = Sunday … 6 = Saturday, for a calendar date (zone-independent). */
export const weekday = ({ y, m, d }: YMD) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/** UTC instant of local midnight at the start of `date` in `timeZone`. */
export function zonedMidnight(timeZone: string, date: YMD): Date {
  const guess = Date.UTC(date.y, date.m - 1, date.d);
  let t = guess - offsetMs(timeZone, guess);
  // Re-evaluate once: the offset at the true midnight can differ from the guess's (DST edge).
  const corrected = guess - offsetMs(timeZone, t);
  if (corrected !== t) t = corrected;
  return new Date(t);
}

/** Start and end of the local calendar day containing `now`. `end` is the next local midnight (23–25 h later). */
export function dayBounds(timeZone: string, now = new Date()) {
  const today = localDate(timeZone, now);
  return { start: zonedMidnight(timeZone, today), end: zonedMidnight(timeZone, addDays(today, 1)) };
}

/** Local midnight on the 1st of the current month. */
export function monthStart(timeZone: string, now = new Date()) {
  const { y, m } = localDate(timeZone, now);
  return zonedMidnight(timeZone, { y, m, d: 1 });
}

/** Consecutive local-day ranges starting at `from` (a calendar date). */
export function localDays(timeZone: string, from: YMD, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(from, i);
    return { date, start: zonedMidnight(timeZone, date), end: zonedMidnight(timeZone, addDays(date, 1)) };
  });
}
