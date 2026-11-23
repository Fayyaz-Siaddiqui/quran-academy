'use client';

import type { ClassSessionSummary } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, PlayCircle, Video } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { AttendanceBadge, ClassStatusBadge } from '@/components/portal/class-row';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatDuration, formatTime } from '@/lib/utils';

type ClassDetail = ClassSessionSummary & {
  cancelReason: string | null;
  attendees: { studentId: string; fullName: string; status: string; joinedAt: string | null; leftAt: string | null }[];
  recordings: { id: string; title: string; durationSeconds: number | null; recordedAt: string }[];
  homework: { id: string; title: string; dueAt: string | null; status: string }[];
};

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useAuthStore((s) => s.user);
  const tz = user?.timezone ?? 'UTC';
  const q = useQuery({ queryKey: ['classes', id], queryFn: () => api<ClassDetail>(`/classes/${id}`), refetchInterval: 30_000 });

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const c = q.data;
  const me = c.attendees.find((a) => a.studentId === user?.id);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/student/classes" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="size-4" /> All classes</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <p className="text-muted-foreground mt-1">{c.course.title} with {c.teacher.fullName}</p>
          <p className="mt-2 text-sm">{formatDateTime(c.startsAt, tz)} – {formatTime(c.endsAt, tz)}</p>
          <div className="mt-3 flex gap-2"><ClassStatusBadge status={c.status} /><AttendanceBadge status={me?.status} /></div>
        </div>
        {c.canJoin ? <Button size="lg" asChild><Link href={`/classroom/${c.id}`}><Video /> Join class</Link></Button> : null}
      </div>
      {c.cancelReason ? <p className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">Cancelled: {c.cancelReason}</p> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><PlayCircle className="text-primary size-4" /> Recordings</CardTitle></CardHeader>
        <CardContent>
          {c.recordings.length ? (
            <ul className="space-y-2 text-sm">
              {c.recordings.map((r) => (
                <li key={r.id}><Link href={`/student/recordings?play=${r.id}`} className="font-medium hover:underline">{r.title}</Link> <span className="text-muted-foreground">· {formatDuration(r.durationSeconds)}</span></li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground text-sm">{c.status === 'COMPLETED' ? 'The recording is being processed and will appear shortly.' : 'Available after the class.'}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="text-primary size-4" /> Homework from this class</CardTitle></CardHeader>
        <CardContent>
          {c.homework.length ? (
            <ul className="space-y-2 text-sm">
              {c.homework.map((h) => (
                <li key={h.id}><Link href="/student/homework" className="font-medium hover:underline">{h.title}</Link>{h.dueAt ? <span className="text-muted-foreground"> · due {formatDateTime(h.dueAt, tz)}</span> : null}</li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground text-sm">No homework assigned.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
