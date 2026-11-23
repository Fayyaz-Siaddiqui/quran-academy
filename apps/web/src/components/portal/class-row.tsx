'use client';

import type { ClassSessionSummary } from '@qa/shared-types';
import { Video } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { formatDateTime, formatTime } from '@/lib/utils';

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  SCHEDULED: { label: 'Scheduled', variant: 'secondary' },
  LIVE: { label: 'Live now', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'outline' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
  MISSED: { label: 'Missed', variant: 'warning' },
};
const ATTENDANCE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  PRESENT: { label: 'Present', variant: 'success' },
  LATE: { label: 'Late', variant: 'warning' },
  ABSENT: { label: 'Absent', variant: 'destructive' },
  EXCUSED: { label: 'Excused', variant: 'outline' },
};

export function ClassStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={s.variant}>{status === 'LIVE' ? <span className="size-1.5 animate-pulse rounded-full bg-current" /> : null}{s.label}</Badge>;
}

export function AttendanceBadge({ status }: { status?: string }) {
  if (!status || status === 'SCHEDULED') return null;
  const a = ATTENDANCE[status];
  return a ? <Badge variant={a.variant}>{a.label}</Badge> : null;
}

/** One class in a list. `timezone` renders times in the viewer's zone; `allowJoin` false for parent views of a child. */
export function ClassRow({ cls, timezone, compact, allowJoin = true, href }: { cls: ClassSessionSummary; timezone: string; compact?: boolean; allowJoin?: boolean; href?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="bg-secondary text-primary flex w-16 shrink-0 flex-col items-center rounded-md py-1.5 text-center">
        <span className="text-[11px] font-medium uppercase">{formatDateTime(cls.startsAt, timezone, { weekday: 'short', day: undefined, month: undefined, hour: undefined, minute: undefined })}</span>
        <span className="text-sm font-bold tabular-nums">{formatTime(cls.startsAt, timezone)}</span>
      </div>
      <div className="min-w-0 flex-1">
        {href ? <Link href={href} className="font-medium hover:underline">{cls.title}</Link> : <p className="font-medium">{cls.title}</p>}
        <p className="text-muted-foreground truncate text-sm">
          {cls.course.title} · {cls.teacher.fullName}{compact ? '' : ` · ${formatDateTime(cls.startsAt, timezone)}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <AttendanceBadge status={cls.attendanceStatus} />
        <ClassStatusBadge status={cls.status} />
        {allowJoin && cls.canJoin ? (
          <Button size="sm" asChild><Link href={`/classroom/${cls.id}`}><Video /> Join</Link></Button>
        ) : null}
      </div>
    </li>
  );
}
