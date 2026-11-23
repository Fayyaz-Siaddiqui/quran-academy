import { addDays, dayBounds, localDate, localDays, monthStart, weekday, ymdString, zonedMidnight } from './time';

const iso = (d: Date) => d.toISOString();
const HOUR = 3_600_000;

describe('time utils (IANA zones, DST-safe)', () => {
  it('resolves local midnight in fixed and DST zones', () => {
    expect(iso(zonedMidnight('UTC', { y: 2026, m: 11, d: 20 }))).toBe('2026-11-20T00:00:00.000Z');
    expect(iso(zonedMidnight('Asia/Dubai', { y: 2026, m: 11, d: 20 }))).toBe('2026-11-19T20:00:00.000Z');
    expect(iso(zonedMidnight('Europe/London', { y: 2026, m: 7, d: 1 }))).toBe('2026-06-30T23:00:00.000Z'); // BST
    expect(iso(zonedMidnight('Europe/London', { y: 2026, m: 12, d: 1 }))).toBe('2026-12-01T00:00:00.000Z'); // GMT
    expect(iso(zonedMidnight('Australia/Sydney', { y: 2026, m: 9, d: 28 }))).toBe('2026-09-27T14:00:00.000Z'); // AEST +10
    expect(iso(zonedMidnight('Australia/Sydney', { y: 2026, m: 11, d: 16 }))).toBe('2026-11-15T13:00:00.000Z'); // AEDT +11
  });

  it('gives 23 h / 25 h days on DST transitions', () => {
    // Sydney springs forward on Sun 4 Oct 2026; London falls back on Sun 25 Oct 2026; LA on Sun 1 Nov 2026.
    const len = (tz: string, d: number, m: number) => {
      const [day] = localDays(tz, { y: 2026, m, d }, 1);
      return (day!.end.getTime() - day!.start.getTime()) / HOUR;
    };
    expect(len('Australia/Sydney', 4, 10)).toBe(23);
    expect(len('Europe/London', 25, 10)).toBe(25);
    expect(len('America/Los_Angeles', 1, 11)).toBe(25);
    expect(len('Asia/Dubai', 4, 10)).toBe(24);
  });

  it('keeps week buckets on Mondays across a DST change (regression)', () => {
    // 20 Nov 2026 is a Friday. Eight Monday-started weeks back crosses Sydney's 4 Oct change.
    const today = localDate('Australia/Sydney', new Date('2026-11-20T01:00:00Z'));
    const monday = addDays(today, -((weekday(today) + 6) % 7));
    const first = addDays(monday, -49);
    expect(ymdString(first)).toBe('2026-09-28');
    expect(weekday(first)).toBe(1);
    expect(localDate('Australia/Sydney', zonedMidnight('Australia/Sydney', first))).toEqual(first);
  });

  it('computes today and month start in the viewer zone', () => {
    const now = new Date('2026-11-20T22:30:00Z'); // already 21 Nov in Dubai and Sydney
    expect(localDate('Asia/Dubai', now)).toEqual({ y: 2026, m: 11, d: 21 });
    expect(localDate('America/Los_Angeles', now)).toEqual({ y: 2026, m: 11, d: 20 });
    const { start, end } = dayBounds('Asia/Dubai', now);
    expect(iso(start)).toBe('2026-11-20T20:00:00.000Z');
    expect(iso(end)).toBe('2026-11-21T20:00:00.000Z');
    expect(iso(monthStart('Australia/Sydney', now))).toBe('2026-10-31T13:00:00.000Z');
  });

  it('rolls calendar dates over months and years', () => {
    expect(addDays({ y: 2026, m: 12, d: 30 }, 3)).toEqual({ y: 2027, m: 1, d: 2 });
    expect(addDays({ y: 2026, m: 3, d: 1 }, -1)).toEqual({ y: 2026, m: 2, d: 28 });
  });
});
