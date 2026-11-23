'use client';

import type { ParentOverview } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Megaphone, Plus, TrendingUp, Users, Video } from 'lucide-react';
import Link from 'next/link';
import { ClassStatusBadge } from '@/components/portal/class-row';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState, UserAvatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { describePortion } from '@/lib/quran';
import { formatDateTime, formatTime } from '@/lib/utils';

export default function ParentDashboard() {
  const q = useQuery({ queryKey: ['dashboard', 'parent'], queryFn: () => api<ParentOverview>('/parents/me/overview'), refetchInterval: 60_000 });
  if (q.isPending) return <LoadingBlock rows={5} />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const tz = d.parent.timezone;
  const liveNow = d.upcomingClasses.filter((c) => c.canJoin);

  return (
    <div className="space-y-6">
      <section className="bg-primary text-primary-foreground pattern-star rounded-xl p-6 sm:p-8">
        <p className="text-sm opacity-80">Assalamu alaikum</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{d.parent.fullName.split(' ')[0]}’s family</h1>
        <p className="mt-2 text-sm opacity-90">
          {d.upcomingClasses.length ? `${d.upcomingClasses.length} class${d.upcomingClasses.length > 1 ? 'es' : ''} this week.` : 'No classes this week.'} Times in {tz.replace(/_/g, ' ')}.
        </p>
        {liveNow.map((c) => (
          <Button key={`${c.id}-${c.child.id}`} variant="gold" className="mt-4 mr-2" asChild>
            <Link href={`/classroom/${c.id}?child=${c.child.id}`}><Video /> Join {c.child.fullName.split(' ')[0]}’s class now</Link>
          </Button>
        ))}
      </section>

      {d.children.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.children.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center gap-3">
                <UserAvatar name={c.fullName} className="size-11" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate">{c.fullName}</CardTitle>
                  <p className="text-muted-foreground truncate text-xs">{c.enrolled ? `${c.courses.join(', ')}${c.teacherName ? ` · ${c.teacherName}` : ''}` : 'Awaiting enrolment'}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-secondary/60 rounded-md py-2"><dt className="text-muted-foreground text-[11px]">Attendance</dt><dd className="font-bold tabular-nums">{c.attendancePercent !== null ? `${c.attendancePercent}%` : '—'}</dd></div>
                  <div className="bg-secondary/60 rounded-md py-2"><dt className="text-muted-foreground text-[11px]">Homework due</dt><dd className={c.pendingHomework ? 'text-warning font-bold' : 'font-bold'}>{c.pendingHomework}</dd></div>
                  <div className="bg-secondary/60 rounded-md py-2"><dt className="text-muted-foreground text-[11px]">Rating</dt><dd className="font-bold">{c.latestProgress?.rating ? `${c.latestProgress.rating}/5` : '—'}</dd></div>
                </dl>
                <p className="text-sm"><span className="text-muted-foreground">Next class: </span>{c.nextClass ? formatDateTime(c.nextClass.startsAt, tz) : 'none scheduled'}</p>
                <p className="text-sm"><span className="text-muted-foreground">Latest lesson: </span>{c.latestProgress ? describePortion(c.latestProgress) : 'not recorded yet'}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild><Link href={`/parent/children/${c.id}`}>Open</Link></Button>
                  {c.nextClass?.canJoin ? <Button size="sm" variant="gold" asChild><Link href={`/classroom/${c.nextClass.id}?child=${c.id}`}><Video /> Join</Link></Button> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="Add your first child" description="Add your children to book classes and follow their progress."
          action={<Button className="mt-2" asChild><Link href="/parent/children"><Plus /> Add a child</Link></Button>} />
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="text-primary size-4" /> This week’s classes</CardTitle></CardHeader>
          <CardContent>
            {d.upcomingClasses.length ? (
              <ul className="divide-y">
                {d.upcomingClasses.map((c) => (
                  <li key={`${c.id}-${c.child.id}`} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="bg-secondary text-primary w-20 shrink-0 rounded-md py-1.5 text-center">
                      <p className="text-[11px] font-medium uppercase">{formatDateTime(c.startsAt, tz, { day: undefined, month: undefined, hour: undefined, minute: undefined })}</p>
                      <p className="text-sm font-bold tabular-nums">{formatTime(c.startsAt, tz)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.child.fullName} <span className="text-muted-foreground font-normal">· {c.course.title}</span></p>
                      <p className="text-muted-foreground text-xs">with {c.teacher.fullName}</p>
                    </div>
                    <ClassStatusBadge status={c.status} />
                    {c.canJoin ? <Button size="sm" asChild><Link href={`/classroom/${c.id}?child=${c.child.id}`}><Video /> Join</Link></Button> : null}
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={CalendarDays} title="No classes in the next 7 days" />}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="text-primary size-4" /> At a glance</CardTitle>
              <CardAction><Button variant="link" size="sm" asChild><Link href="/parent/children">Manage children</Link></Button></CardAction>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {d.children.filter((c) => c.pendingHomework).map((c) => (
                <p key={c.id}><Badge variant="warning" className="mr-1">{c.pendingHomework}</Badge> homework for {c.fullName.split(' ')[0]}</p>
              ))}
              {d.children.filter((c) => !c.enrolled).map((c) => (
                <p key={c.id}><Badge variant="secondary" className="mr-1">pending</Badge> {c.fullName.split(' ')[0]} is waiting for enrolment — the academy will contact you.</p>
              ))}
              {d.children.every((c) => !c.pendingHomework && c.enrolled) ? <p className="text-muted-foreground flex items-center gap-1"><TrendingUp className="size-4" /> All on track.</p> : null}
            </CardContent>
          </Card>
          {d.announcements.length ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="text-primary size-4" /> Announcements</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {d.announcements.map((a) => <div key={a.id}><p className="font-medium">{a.title}</p><p className="text-muted-foreground text-sm whitespace-pre-line">{a.body}</p></div>)}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
