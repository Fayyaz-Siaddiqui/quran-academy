'use client';

import type { ClassSessionSummary, StudentDashboard } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, ClipboardList, Loader2, PlayCircle, Video } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { AttendanceBadge, ClassStatusBadge } from '@/components/portal/class-row';
import { ProgressView } from '@/components/portal/progress-view';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { StudentDashboardView } from '@/components/portal/student-dashboard-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger, UserAvatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatDuration } from '@/lib/utils';

type Homework = {
  id: string; title: string; instructions: string; dueAt: string | null; status: string;
  course: { title: string }; teacher: { fullName: string };
  submissions: { submittedAt: string; grade: number | null; feedback: string | null; reviewedAt: string | null }[];
};
type Recording = { id: string; title: string; durationSeconds: number | null; recordedAt: string; classSession: { title: string; course: { title: string } } };
type Profile = {
  fullName: string; email: string | null; timezone: string; preferredLanguage: string | null;
  studentProfile: { dateOfBirth: string | null; preferredClassTiming: string | null; level: string | null } | null;
  assignedTeacher: { fullName: string; teacherProfile: { bio: string | null; languages: string[]; experienceYears: number; certifications: string[] } | null } | null;
};
const HW = { ASSIGNED: 'secondary', SUBMITTED: 'success', REVIEWED: 'gold', OVERDUE: 'destructive' } as Record<string, 'secondary' | 'success' | 'gold' | 'destructive'>;

function ClassesTab({ childId, tz }: { childId: string; tz?: string }) {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const q = useQuery({ queryKey: ['classes', 'child', childId, scope], queryFn: () => api<ClassSessionSummary[]>(`/classes?studentId=${childId}&scope=${scope}&limit=100`), refetchInterval: 60_000 });
  return (
    <Card>
      <CardContent className="space-y-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}><TabsList><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="past">Past & attendance</TabsTrigger></TabsList></Tabs>
        {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} /> : q.data.length ? (
          <ul className="divide-y">
            {q.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-muted-foreground text-xs">{formatDateTime(c.startsAt, tz)} · {c.teacher.fullName}</p>
                </div>
                <AttendanceBadge status={c.attendanceStatus} />
                <ClassStatusBadge status={c.status} />
                {c.canJoin ? <Button size="sm" asChild><Link href={`/classroom/${c.id}?child=${childId}`}><Video /> Join</Link></Button> : null}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={CalendarDays} title={scope === 'upcoming' ? 'No upcoming classes' : 'No past classes'} />}
      </CardContent>
    </Card>
  );
}

function HomeworkTab({ childId, tz }: { childId: string; tz?: string }) {
  const q = useQuery({ queryKey: ['homework', 'child', childId], queryFn: () => api<Homework[]>(`/students/${childId}/homework`) });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} />;
  if (!q.data.length) return <EmptyState icon={ClipboardList} title="No homework yet" />;
  return (
    <div className="grid gap-3">
      {q.data.map((h) => {
        const s = h.submissions[0];
        return (
          <Card key={h.id}>
            <CardContent className="space-y-2">
              <p className="font-medium">{h.title} <Badge variant={HW[h.status] ?? 'secondary'} className="ml-1">{h.status.toLowerCase()}</Badge></p>
              <p className="text-muted-foreground text-xs">{h.course.title} · {h.teacher.fullName}{h.dueAt ? ` · due ${formatDateTime(h.dueAt, tz)}` : ''}</p>
              <p className="text-sm whitespace-pre-line">{h.instructions}</p>
              {s?.reviewedAt ? <div className="bg-accent/60 rounded-md p-3 text-sm"><p className="font-semibold">Teacher feedback · {s.grade}/100</p><p className="mt-1 whitespace-pre-line">{s.feedback}</p></div> : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecordingsTab({ childId, tz }: { childId: string; tz?: string }) {
  const q = useQuery({ queryKey: ['recordings', 'child', childId], queryFn: () => api<Recording[]>(`/students/${childId}/recordings`) });
  const [play, setPlay] = useState<Recording | null>(null);
  const url = useQuery({ queryKey: ['recording-url', play?.id], queryFn: () => api<{ url: string }>(`/recordings/${play!.id}/url`), enabled: !!play });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} />;
  return (
    <>
      {q.data.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((r) => (
            <Card key={r.id} className="hover:border-primary/40 cursor-pointer" onClick={() => setPlay(r)}>
              <CardContent className="flex gap-3">
                <PlayCircle className="text-primary size-8 shrink-0" />
                <div className="min-w-0"><p className="truncate font-medium">{r.classSession.title}</p><p className="text-muted-foreground text-xs">{formatDateTime(r.recordedAt, tz)} · {formatDuration(r.durationSeconds)}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={PlayCircle} title="No recordings yet" />}
      <Dialog open={!!play} onOpenChange={(o) => !o && setPlay(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{play?.title}</DialogTitle></DialogHeader>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          {url.data ? <video src={url.data.url} controls autoPlay controlsList="nodownload" className="aspect-video w-full rounded-lg bg-black" /> : <Loader2 className="animate-spin" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileTab({ childId }: { childId: string }) {
  const q = useQuery({ queryKey: ['child-profile', childId], queryFn: () => api<Profile>(`/students/${childId}/profile`) });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} />;
  const p = q.data;
  const t = p.assignedTeacher;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardContent className="space-y-1.5 text-sm">
        <p><span className="text-muted-foreground">Login: </span>{p.email ?? 'Managed by you (no own login)'}</p>
        <p><span className="text-muted-foreground">Time zone: </span>{p.timezone.replace(/_/g, ' ')}</p>
        <p><span className="text-muted-foreground">Language: </span>{p.preferredLanguage ?? '—'}</p>
        <p><span className="text-muted-foreground">Preferred timing: </span>{p.studentProfile?.preferredClassTiming?.replace('-', ' ') ?? '—'}</p>
        <p><span className="text-muted-foreground">Level: </span>{p.studentProfile?.level ?? 'Assessed by teacher'}</p>
      </CardContent></Card>
      <Card><CardContent>
        {t ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3"><UserAvatar name={t.fullName} className="size-11" /><div><p className="font-medium">{t.fullName}</p><p className="text-muted-foreground text-xs">{t.teacherProfile?.experienceYears}+ years · {t.teacherProfile?.languages.join(', ')}</p></div></div>
            {t.teacherProfile?.bio ? <p className="text-muted-foreground text-sm">{t.teacherProfile.bio}</p> : null}
            <div className="flex flex-wrap gap-1">{t.teacherProfile?.certifications.map((c) => <Badge key={c} variant="gold">{c}</Badge>)}</div>
          </div>
        ) : <p className="text-muted-foreground text-sm">A teacher will be assigned after the assessment class.</p>}
      </CardContent></Card>
    </div>
  );
}

export default function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tz = useAuthStore((s) => s.user?.timezone);
  const dash = useQuery({ queryKey: ['dashboard', 'child', id], queryFn: () => api<StudentDashboard>(`/parents/me/children/${id}/dashboard`) });

  return (
    <div className="space-y-4">
      <Link href="/parent" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="size-4" /> Family overview</Link>
      <Tabs defaultValue="overview">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="homework">Homework</TabsTrigger>
            <TabsTrigger value="recordings">Recordings</TabsTrigger>
            <TabsTrigger value="progress">Quran progress</TabsTrigger>
            <TabsTrigger value="profile">Profile & teacher</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4">
          {dash.isPending ? <LoadingBlock rows={5} /> : dash.isError ? <ErrorBlock error={dash.error} retry={() => dash.refetch()} /> : (
            <StudentDashboardView data={dash.data} isOwn={false} viewerTimezone={tz} basePath={`/parent/children/${id}`} />
          )}
        </TabsContent>
        <TabsContent value="classes" className="mt-4"><ClassesTab childId={id} tz={tz} /></TabsContent>
        <TabsContent value="homework" className="mt-4"><HomeworkTab childId={id} tz={tz} /></TabsContent>
        <TabsContent value="recordings" className="mt-4"><RecordingsTab childId={id} tz={tz} /></TabsContent>
        <TabsContent value="progress" className="mt-4"><ProgressView studentId={id} /></TabsContent>
        <TabsContent value="profile" className="mt-4"><ProfileTab childId={id} /></TabsContent>
      </Tabs>
    </div>
  );
}
