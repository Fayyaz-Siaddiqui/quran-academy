'use client';

import type { TeacherDashboard } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, ClipboardCheck, Clock, NotebookPen, Users, Video } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ClassRow } from '@/components/portal/class-row';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { ReviewHomeworkDialog, type TeachingHomework } from '@/components/teacher/teacher-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-4">
        <div className="bg-secondary text-primary flex size-11 items-center justify-center rounded-lg"><Icon className="size-5" aria-hidden /></div>
        <div><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-muted-foreground text-xs">{label}</p></div>
      </CardContent>
    </Card>
  );
}

export default function TeacherDashboardPage() {
  const q = useQuery({ queryKey: ['teacher', 'dashboard'], queryFn: () => api<TeacherDashboard>('/teachers/me/dashboard'), refetchInterval: 60_000 });
  const [reviewId, setReviewId] = useState<string | null>(null);
  // Review dialog needs the full homework record; reuse the review queue query.
  const queue = useQuery({
    queryKey: ['teacher', 'homework', 'SUBMITTED'],
    queryFn: () => api<TeachingHomework[]>('/homework/teaching?status=SUBMITTED'),
    enabled: !!reviewId,
  });
  const reviewing = queue.data?.find((h) => h.id === reviewId);

  if (q.isPending) return <LoadingBlock rows={5} />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const tz = d.teacher.timezone;
  const next = d.todaysClasses.find((c) => c.canJoin) ?? d.todaysClasses.find((c) => c.status === 'SCHEDULED' && new Date(c.endsAt) > new Date());

  return (
    <div className="space-y-6">
      <section className="bg-primary text-primary-foreground pattern-star rounded-xl p-6 sm:p-8">
        <p className="text-sm opacity-80">Assalamu alaikum</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{d.teacher.fullName.split(' ').slice(0, 2).join(' ')}</h1>
        <p className="mt-2 text-sm opacity-90">
          {d.todaysClasses.length ? `You have ${d.todaysClasses.length} class${d.todaysClasses.length > 1 ? 'es' : ''} today.` : 'No classes today.'} Times in {tz.replace(/_/g, ' ')}.
        </p>
        {next ? (
          next.canJoin ? (
            <Button variant="gold" className="mt-5" asChild><Link href={`/classroom/${next.id}`}><Video /> {next.status === 'LIVE' ? 'Rejoin' : 'Start'} {next.title}</Link></Button>
          ) : <p className="mt-4 text-sm">Next: <strong>{next.title}</strong> at {formatDateTime(next.startsAt, tz, { weekday: undefined, day: undefined, month: undefined })}</p>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Active students" value={d.stats.activeStudents} />
        <Stat icon={CalendarCheck} label="Classes this month" value={d.stats.classesThisMonth} />
        <Stat icon={Clock} label="Teaching hours this month" value={d.stats.hoursThisMonth} />
        <Stat icon={ClipboardCheck} label="Attendance (30 days)" value={`${d.stats.attendanceRate30d}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="text-primary size-4" /> Today</CardTitle>
              <CardAction><Button variant="link" size="sm" asChild><Link href="/teacher/classes">Full schedule</Link></Button></CardAction>
            </CardHeader>
            <CardContent>
              {d.todaysClasses.length ? (
                <ul className="divide-y">{d.todaysClasses.map((c) => <ClassRow key={c.id} cls={c} timezone={tz} compact href={`/teacher/classes/${c.id}`} />)}</ul>
              ) : <EmptyState icon={CalendarDays} title="Nothing scheduled today" />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Coming up</CardTitle></CardHeader>
            <CardContent>
              {d.upcomingClasses.length ? (
                <ul className="divide-y">{d.upcomingClasses.map((c) => <ClassRow key={c.id} cls={c} timezone={tz} href={`/teacher/classes/${c.id}`} />)}</ul>
              ) : <p className="text-muted-foreground text-sm">No further classes scheduled.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardCheck className="text-primary size-4" /> To review {d.stats.pendingReviewCount ? `(${d.stats.pendingReviewCount})` : ''}</CardTitle>
              <CardAction><Button variant="link" size="sm" asChild><Link href="/teacher/homework">All</Link></Button></CardAction>
            </CardHeader>
            <CardContent>
              {d.pendingReviews.length ? (
                <ul className="space-y-3">
                  {d.pendingReviews.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{h.title}</p>
                        <p className="text-muted-foreground text-xs">{h.studentName} · {formatDateTime(h.submittedAt, tz)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setReviewId(h.id)}>Review</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">No submissions waiting. ✓</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><NotebookPen className="text-primary size-4" /> Add class notes</CardTitle></CardHeader>
            <CardContent>
              {d.classesAwaitingNotes.length ? (
                <ul className="space-y-2 text-sm">
                  {d.classesAwaitingNotes.map((c) => (
                    <li key={c.id}>
                      <Link href={`/teacher/classes/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                      <p className="text-muted-foreground text-xs">{formatDateTime(c.startsAt, tz)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">All recent classes have notes.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {reviewId && reviewing ? <ReviewHomeworkDialog homework={reviewing} onClose={() => setReviewId(null)} /> : null}
    </div>
  );
}
