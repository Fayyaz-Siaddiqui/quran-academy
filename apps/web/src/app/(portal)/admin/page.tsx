'use client';

import { PERMISSIONS, type AdminOverview } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck, CalendarDays, ChevronRight, Clock, GraduationCap, Inbox, Mail, Radio, UserCheck, UserPlus, Users,
} from 'lucide-react';
import Link from 'next/link';
import { BarChart } from '@/components/admin/bar-chart';
import { AttendanceBadge, ClassStatusBadge } from '@/components/portal/class-row';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatTime } from '@/lib/utils';

function Kpi({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent>
        <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium"><Icon className="size-4" aria-hidden /> {label}</div>
        <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

const dayLabel = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));

export default function AdminOverviewPage() {
  const user = useAuthStore((s) => s.user);
  const allowed = can(user, PERMISSIONS.STUDENTS_READ) && can(user, PERMISSIONS.CLASSES_READ);
  const q = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api<AdminOverview>('/admin/overview'), enabled: allowed, refetchInterval: 60_000 });

  if (!allowed) {
    // Roles like Accountant land here without academic access — show their shortcuts only.
    return (
      <>
        <PageTitle title="Administration" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {can(user, PERMISSIONS.USERS_READ) ? <Link href="/admin/users"><Card className="hover:border-primary/40"><CardContent className="font-medium">Users →</CardContent></Card></Link> : null}
          {can(user, PERMISSIONS.LEADS_READ) ? <Link href="/admin/leads"><Card className="hover:border-primary/40"><CardContent className="font-medium">Leads inbox →</CardContent></Card></Link> : null}
          {can(user, PERMISSIONS.CMS_MANAGE) ? <Link href="/admin/cms"><Card className="hover:border-primary/40"><CardContent className="font-medium">Website content →</CardContent></Card></Link> : null}
        </div>
      </>
    );
  }
  if (q.isPending) return <LoadingBlock rows={6} />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const tz = d.timezone;

  const actions = [
    { count: d.actions.pendingTeacherApprovals, label: 'teacher applications to review', href: '/admin/teacher-approvals', icon: UserCheck, perm: PERMISSIONS.TEACHERS_READ },
    { count: d.actions.newTrialBookings, label: 'new free-trial requests', href: '/admin/leads', icon: Inbox, perm: PERMISSIONS.LEADS_READ },
    { count: d.actions.newContactMessages, label: 'unread contact messages', href: '/admin/leads?tab=messages', icon: Mail, perm: PERMISSIONS.LEADS_READ },
    { count: d.actions.studentsAwaitingEnrollment, label: 'students waiting to be enrolled', href: '/admin/enrollments', icon: UserPlus, perm: PERMISSIONS.STUDENTS_READ },
  ].filter((a) => a.count > 0 && can(user, a.perm));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Academy overview"
        description={`Live figures in ${tz.replace(/_/g, ' ')} · updated ${formatTime(d.generatedAt, tz)}`}
        actions={can(user, PERMISSIONS.CLASSES_MANAGE) ? <Button asChild><Link href="/admin/schedule?new=1"><CalendarDays /> Schedule a class</Link></Button> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Active students" value={d.kpis.activeStudents} />
        <Kpi icon={GraduationCap} label="Active teachers" value={d.kpis.activeTeachers} />
        <Kpi icon={CalendarDays} label="Classes today" value={d.kpis.classesToday} hint={d.kpis.liveNow ? `${d.kpis.liveNow} live now` : undefined} />
        <Kpi icon={CalendarCheck} label="Attendance · 30 days" value={`${d.kpis.attendanceRate30d}%`} hint={`${d.kpis.completedThisMonth} classes · ${d.kpis.teachingHoursThisMonth} h this month`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Needs attention</CardTitle></CardHeader>
        <CardContent>
          {actions.length ? (
            <ul className="divide-y">
              {actions.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="hover:bg-secondary/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5">
                    <a.icon className="text-primary size-5" aria-hidden />
                    <span className="flex-1 text-sm"><span className="font-semibold tabular-nums">{a.count}</span> {a.label}</span>
                    <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground text-sm">Nothing waiting — all caught up.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>New students per week</CardTitle><CardDescription>Last 8 weeks, weeks starting Monday</CardDescription></CardHeader>
          <CardContent>
            <BarChart
              ariaLabel="New students per week, last 8 weeks"
              unit="students"
              data={d.signupsByWeek.map((w) => ({ key: w.weekStart, label: dayLabel(w.weekStart, { day: 'numeric', month: 'short' }), detail: `Week of ${dayLabel(w.weekStart, { day: 'numeric', month: 'long' })}`, value: w.count }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Classes scheduled, next 7 days</CardTitle><CardDescription>Including today</CardDescription></CardHeader>
          <CardContent>
            <BarChart
              ariaLabel="Classes scheduled per day, next 7 days"
              unit="classes"
              data={d.classesNext7Days.map((c, i) => ({ key: c.date, label: i === 0 ? 'Today' : dayLabel(c.date, { weekday: 'short' }), detail: dayLabel(c.date, { weekday: 'long', day: 'numeric', month: 'long' }), value: c.count }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{d.kpis.liveNow ? <Radio className="text-success size-4" aria-hidden /> : <Clock className="text-primary size-4" aria-hidden />} Today’s classes</CardTitle>
            <CardAction><Button variant="link" size="sm" asChild><Link href="/admin/schedule">Open schedule</Link></Button></CardAction>
          </CardHeader>
          <CardContent>
            {d.todaysClasses.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-left text-xs">
                    <tr><th className="py-2 pr-3 font-medium">Time</th><th className="py-2 pr-3 font-medium">Class</th><th className="py-2 pr-3 font-medium">Teacher</th><th className="py-2 pr-3 font-medium">Students</th><th className="py-2 font-medium">Status</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.todaysClasses.map((c) => (
                      <tr key={c.id} className="align-top">
                        <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">{formatTime(c.startsAt, tz)}</td>
                        <td className="py-2.5 pr-3"><p className="font-medium">{c.title}</p><p className="text-muted-foreground text-xs">{c.course.title}</p></td>
                        <td className="py-2.5 pr-3">{c.teacher.fullName}</td>
                        <td className="py-2.5 pr-3">
                          <ul className="space-y-1">{c.attendees.map((a) => <li key={a.studentId} className="flex flex-wrap items-center gap-1.5">{a.fullName} <AttendanceBadge status={a.status} /></li>)}</ul>
                        </td>
                        <td className="py-2.5"><ClassStatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={CalendarDays} title="No classes today" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="text-primary size-4" aria-hidden /> Recent sign-ups</CardTitle>
            {can(user, PERMISSIONS.USERS_READ) ? <CardAction><Button variant="link" size="sm" asChild><Link href="/admin/users">All users</Link></Button></CardAction> : null}
          </CardHeader>
          <CardContent>
            {d.recentSignups.length ? (
              <ul className="space-y-3 text-sm">
                {d.recentSignups.map((u) => (
                  <li key={u.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.fullName}</p>
                      <p className="text-muted-foreground text-xs">{formatDateTime(u.createdAt, tz)}{u.country ? ` · ${u.country}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary">{u.role}</Badge>
                      {u.status !== 'ACTIVE' ? <span className="text-muted-foreground text-[11px]">{u.status.replace(/_/g, ' ').toLowerCase()}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground text-sm">No sign-ups yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
