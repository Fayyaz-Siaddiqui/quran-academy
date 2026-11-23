'use client';

import type { StudentDashboard } from '@qa/shared-types';
import { Bell, BookOpen, CalendarCheck, CalendarDays, ClipboardList, Megaphone, PlayCircle, Target, TrendingUp, UserRound } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState, Progress, UserAvatar } from '@/components/ui/misc';
import { formatDateTime, formatDuration } from '@/lib/utils';
import { ClassRow } from './class-row';

const HW_STATUS: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = { ASSIGNED: 'secondary', SUBMITTED: 'success', OVERDUE: 'destructive', REVIEWED: 'success' };
const PROGRESS_LABEL: Record<string, string> = { QAIDA: 'Qaida', READING: 'Reading', MEMORIZATION: 'Hifz', REVISION: 'Revision', TAJWEED: 'Tajweed' };

function Stat({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex items-center gap-4">
        <div className="bg-secondary text-primary flex size-11 items-center justify-center rounded-lg"><Icon className="size-5" aria-hidden /></div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-muted-foreground text-xs">{label}{hint ? ` · ${hint}` : ''}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Student dashboard. `basePath` lets parents reuse it for a child
 * (links then point at read-only child views and Join is hidden).
 */
export function StudentDashboardView({ data, basePath = '/student', viewerTimezone, isOwn = true }: { data: StudentDashboard; basePath?: string; viewerTimezone?: string; isOwn?: boolean }) {
  const tz = viewerTimezone ?? data.student.timezone;
  const firstName = data.student.fullName.split(' ')[0];
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const live = data.upcomingClasses.find((c) => c.status === 'LIVE' || c.canJoin);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="bg-primary text-primary-foreground pattern-star relative overflow-hidden rounded-xl p-6 sm:p-8">
        <p className="text-sm opacity-80">Assalamu alaikum</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{isOwn ? `${greeting}, ${firstName}` : `${data.student.fullName}’s dashboard`}</h1>
        <p className="mt-2 max-w-xl text-sm opacity-90">
          {data.todaysClasses.length
            ? `${data.todaysClasses.length} class${data.todaysClasses.length > 1 ? 'es' : ''} today. Times shown in ${tz.replace(/_/g, ' ')}.`
            : 'No classes today — a perfect time to revise.'}
        </p>
        {live && isOwn ? (
          <Button variant="gold" className="mt-5" asChild>
            <Link href={`/classroom/${live.id}`}>{live.status === 'LIVE' ? 'Join live class now' : 'Join class'}</Link>
          </Button>
        ) : null}
      </section>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CalendarCheck} label="Classes attended" value={data.stats.completedClasses} />
        <Stat icon={Target} label="Attendance" value={`${data.stats.attendancePercent}%`} />
        <Stat icon={ClipboardList} label="Homework due" value={data.stats.pendingHomework} />
        <Stat icon={TrendingUp} label="Course progress" value={`${data.stats.overallProgressPercent}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Today's timetable */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="text-primary size-4" /> Today’s timetable</CardTitle>
            </CardHeader>
            <CardContent>
              {data.todaysClasses.length ? (
                <ul className="divide-y">{data.todaysClasses.map((c) => <ClassRow key={c.id} cls={c} timezone={tz} compact allowJoin={isOwn} />)}</ul>
              ) : (
                <EmptyState icon={CalendarDays} title="Nothing scheduled today" />
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming classes</CardTitle>
              {isOwn ? <CardAction><Button variant="link" size="sm" asChild><Link href={`${basePath}/classes`}>View all</Link></Button></CardAction> : null}
            </CardHeader>
            <CardContent>
              {data.upcomingClasses.length ? (
                <ul className="divide-y">{data.upcomingClasses.map((c) => <ClassRow key={c.id} cls={c} timezone={tz} allowJoin={isOwn} href={isOwn ? `${basePath}/classes/${c.id}` : undefined} />)}</ul>
              ) : (
                <EmptyState icon={CalendarDays} title="No upcoming classes" description="Your academy will schedule classes once your teacher is assigned." />
              )}
            </CardContent>
          </Card>

          {/* Courses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="text-primary size-4" /> Active courses</CardTitle>
              {isOwn ? <CardAction><Button variant="link" size="sm" asChild><Link href={`${basePath}/courses`}>Open lessons</Link></Button></CardAction> : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {data.activeCourses.length ? (
                data.activeCourses.map((c) => (
                  <div key={c.enrollmentId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{c.title}</span>
                      <span className="text-muted-foreground tabular-nums">{c.progressPercent}%</span>
                    </div>
                    <Progress value={c.progressPercent} aria-label={`${c.title} progress`} />
                    {c.teacherName ? <p className="text-muted-foreground mt-1 text-xs">with {c.teacherName}</p> : null}
                  </div>
                ))
              ) : (
                <EmptyState icon={BookOpen} title="No active enrolments yet" />
              )}
            </CardContent>
          </Card>

          {/* Homework */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="text-primary size-4" /> Homework</CardTitle>
              {isOwn ? <CardAction><Button variant="link" size="sm" asChild><Link href={`${basePath}/homework`}>View all</Link></Button></CardAction> : null}
            </CardHeader>
            <CardContent>
              {data.homework.length ? (
                <ul className="divide-y">
                  {data.homework.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{h.title}</p>
                        <p className="text-muted-foreground text-sm">{h.courseTitle}{h.dueAt ? ` · due ${formatDateTime(h.dueAt, tz)}` : ''}</p>
                      </div>
                      <Badge variant={HW_STATUS[h.status] ?? 'secondary'}>{h.status.toLowerCase()}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={ClipboardList} title="All caught up" description="No pending homework." />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Teacher */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="text-primary size-4" /> Your teacher</CardTitle></CardHeader>
            <CardContent>
              {data.assignedTeacher ? (
                <div className="flex items-center gap-3">
                  <UserAvatar name={data.assignedTeacher.fullName} src={data.assignedTeacher.avatarUrl} className="size-12" />
                  <div>
                    <p className="font-medium">{data.assignedTeacher.fullName}</p>
                    <p className="text-muted-foreground text-xs">{data.assignedTeacher.languages.join(' · ')}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">A teacher will be assigned after your assessment.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="text-primary size-4" /> Learning progress</CardTitle>
              {isOwn ? <CardAction><Button variant="link" size="sm" asChild><Link href={`${basePath}/progress`}>Details</Link></Button></CardAction> : null}
            </CardHeader>
            <CardContent>
              {data.recentProgress.length ? (
                <ul className="space-y-3 text-sm">
                  {data.recentProgress.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2">
                      <span>
                        <Badge variant="gold" className="mr-2">{PROGRESS_LABEL[p.type] ?? p.type}</Badge>
                        {p.surah ? `Surah ${p.surah}: ${p.ayahFrom}–${p.ayahTo}` : 'Qaida lesson'}
                      </span>
                      {p.rating ? <span className="text-muted-foreground shrink-0 text-xs">{'★'.repeat(p.rating)}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Your teacher records progress after each class.</p>
              )}
            </CardContent>
          </Card>

          {/* Recordings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PlayCircle className="text-primary size-4" /> Recent recordings</CardTitle>
              {isOwn ? <CardAction><Button variant="link" size="sm" asChild><Link href={`${basePath}/recordings`}>All</Link></Button></CardAction> : null}
            </CardHeader>
            <CardContent>
              {data.recentRecordings.length ? (
                <ul className="space-y-3 text-sm">
                  {data.recentRecordings.map((r) => (
                    <li key={r.id}>
                      {isOwn ? <Link href={`${basePath}/recordings?play=${r.id}`} className="font-medium hover:underline">{r.title}</Link> : <span className="font-medium">{r.title}</span>}
                      <p className="text-muted-foreground text-xs">{formatDateTime(r.recordedAt, tz)} · {formatDuration(r.durationSeconds)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Recordings appear here after each class.</p>
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          {data.announcements.length ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="text-primary size-4" /> Announcements</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {data.announcements.map((a) => (
                  <div key={a.id}>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">{a.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Notifications */}
          {isOwn ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="text-primary size-4" /> Notifications</CardTitle>
                <CardAction><Button variant="link" size="sm" asChild><Link href="/notifications">All</Link></Button></CardAction>
              </CardHeader>
              <CardContent>
                {data.notifications.length ? (
                  <ul className="space-y-3 text-sm">
                    {data.notifications.map((n) => (
                      <li key={n.id} className="flex gap-2">
                        {!n.readAt ? <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-label="Unread" /> : <span className="size-2 shrink-0" />}
                        <div><p className="font-medium">{n.title}</p><p className="text-muted-foreground text-xs">{n.body}</p></div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">You’re all caught up.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
