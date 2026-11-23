'use client';

import type { AttendanceStatus, ClassSessionSummary } from '@qa/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Loader2, PlayCircle, TrendingUp, Video } from 'lucide-react';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClassStatusBadge } from '@/components/portal/class-row';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { AssignHomeworkDialog, RecordProgressDialog } from '@/components/teacher/teacher-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Badge, UserAvatar } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatDuration, formatTime } from '@/lib/utils';

type ClassDetail = ClassSessionSummary & {
  teacherNotes: string | null;
  cancelReason: string | null;
  attendees: { studentId: string; fullName: string; status: AttendanceStatus; joinedAt: string | null; leftAt: string | null }[];
  recordings: { id: string; title: string; durationSeconds: number | null; recordedAt: string }[];
  homework: { id: string; title: string; dueAt: string | null; status: string; studentId: string }[];
};

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

export default function TeacherClassDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['classes', id], queryFn: () => api<ClassDetail>(`/classes/${id}`), refetchInterval: 30_000 });
  const [notes, setNotes] = useState('');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [action, setAction] = useState<{ kind: 'progress' | 'homework'; student: { id: string; fullName: string } } | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setNotes(q.data.teacherNotes ?? '');
    setAttendance(Object.fromEntries(q.data.attendees.map((a) => [a.studentId, a.status])));
    // Only reset local edits when a different class loads or after a save, not on every 30 s refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.id, q.data?.teacherNotes]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['classes'] });
    void qc.invalidateQueries({ queryKey: ['teacher'] });
  };
  const saveNotes = useMutation({
    mutationFn: () => api(`/classes/${id}/notes`, { method: 'PATCH', body: { teacherNotes: notes } }),
    onSuccess: () => { toast.success('Notes saved'); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save notes'),
  });
  const saveAttendance = useMutation({
    mutationFn: () => api(`/classes/${id}/attendance`, {
      method: 'PATCH',
      body: { entries: Object.entries(attendance).filter(([, s]) => s !== 'SCHEDULED').map(([studentId, status]) => ({ studentId, status })) },
    }),
    onSuccess: () => { toast.success('Attendance saved'); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save attendance'),
  });

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const c = q.data;
  const started = new Date(c.startsAt) <= new Date();
  const attendanceDirty = c.attendees.some((a) => attendance[a.studentId] !== a.status);
  const allMarked = Object.values(attendance).every((s) => s !== 'SCHEDULED');

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/teacher/classes" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="size-4" /> Schedule</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <p className="text-muted-foreground mt-1">{c.course.title}</p>
          <p className="mt-2 text-sm">{formatDateTime(c.startsAt, tz)} – {formatTime(c.endsAt, tz)}</p>
          <div className="mt-3"><ClassStatusBadge status={c.status} /></div>
        </div>
        {c.canJoin ? (
          <Button size="lg" asChild><Link href={`/classroom/${c.id}`}><Video /> {c.status === 'LIVE' ? 'Rejoin class' : 'Start class'}</Link></Button>
        ) : c.status === 'SCHEDULED' && !started ? <p className="text-muted-foreground text-sm">Opens 10 minutes before the start time.</p> : null}
      </div>
      {c.cancelReason ? <p className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">Cancelled: {c.cancelReason}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Students & attendance</CardTitle>
          <CardDescription>
            {started ? 'Join and leave times come from the live classroom. Correct anything here.' : 'Attendance can be marked once the class starts.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {c.attendees.map((a) => (
              <li key={a.studentId} className="flex flex-wrap items-center gap-3 py-3">
                <UserAvatar name={a.fullName} />
                <div className="min-w-0 flex-1">
                  <Link href={`/teacher/students/${a.studentId}`} className="font-medium hover:underline">{a.fullName}</Link>
                  <p className="text-muted-foreground text-xs">
                    {a.joinedAt ? `Joined ${formatTime(a.joinedAt, tz)}${a.leftAt ? ` · left ${formatTime(a.leftAt, tz)}` : ''}` : 'Did not join online'}
                  </p>
                </div>
                <Select aria-label={`Attendance for ${a.fullName}`} className="w-32" disabled={!started || c.status === 'CANCELLED'}
                  value={attendance[a.studentId] ?? a.status} onChange={(e) => setAttendance((x) => ({ ...x, [a.studentId]: e.target.value as AttendanceStatus }))}>
                  {attendance[a.studentId] === 'SCHEDULED' ? <option value="SCHEDULED">Not marked</option> : null}
                  {ATTENDANCE_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setAction({ kind: 'progress', student: { id: a.studentId, fullName: a.fullName } })}><TrendingUp /> Progress</Button>
                  <Button size="sm" variant="outline" onClick={() => setAction({ kind: 'homework', student: { id: a.studentId, fullName: a.fullName } })}><ClipboardList /> Homework</Button>
                </div>
              </li>
            ))}
          </ul>
          {started && c.status !== 'CANCELLED' ? (
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={() => saveAttendance.mutate()} disabled={!attendanceDirty || !allMarked || saveAttendance.isPending}>
                {saveAttendance.isPending ? <Loader2 className="animate-spin" /> : null} Save attendance
              </Button>
              {!allMarked ? <span className="text-muted-foreground text-xs">Mark every student to save.</span> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Class notes</CardTitle>
            <CardDescription>Private to you and academy staff — what was covered, what to do next time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea aria-label="Class notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={c.status === 'CANCELLED'} />
            <Button onClick={() => saveNotes.mutate()} disabled={notes === (c.teacherNotes ?? '') || saveNotes.isPending}>
              {saveNotes.isPending ? <Loader2 className="animate-spin" /> : null} Save notes
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="text-primary size-4" /> Homework set in this class</CardTitle></CardHeader>
            <CardContent>
              {c.homework.length ? (
                <ul className="space-y-2 text-sm">
                  {c.homework.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{h.title}</span>
                        <span className="text-muted-foreground"> · {c.attendees.find((a) => a.studentId === h.studentId)?.fullName}</span>
                      </span>
                      <Badge variant={h.status === 'SUBMITTED' ? 'warning' : h.status === 'REVIEWED' ? 'success' : 'secondary'}>{h.status.toLowerCase()}</Badge>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">None yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><PlayCircle className="text-primary size-4" /> Recordings</CardTitle></CardHeader>
            <CardContent>
              {c.recordings.length ? (
                <ul className="space-y-2 text-sm">
                  {c.recordings.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span>{r.title} <span className="text-muted-foreground">· {formatDuration(r.durationSeconds)}</span></span>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try { window.open((await api<{ url: string }>(`/recordings/${r.id}/url`)).url, '_blank', 'noopener,noreferrer'); }
                        catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not open recording'); }
                      }}>Watch</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">{c.status === 'COMPLETED' ? 'Processing — recordings appear shortly after class.' : 'Available after the class.'}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {action?.kind === 'progress' ? <RecordProgressDialog student={action.student} onClose={() => setAction(null)} /> : null}
      {action?.kind === 'homework' ? (
        <AssignHomeworkDialog student={action.student} classSession={{ id: c.id, course: { id: c.course.id, title: c.course.title } }} onClose={() => setAction(null)} />
      ) : null}
    </div>
  );
}
