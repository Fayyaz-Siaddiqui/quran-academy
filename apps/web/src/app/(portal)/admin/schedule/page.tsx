'use client';

import { PERMISSIONS, type ClassSessionSummary } from '@qa/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Video } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { StudentPicker, TeacherSelect, useCourses, type PersonOption } from '@/components/admin/pickers';
import { AttendanceBadge, ClassStatusBadge } from '@/components/portal/class-row';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { cn, formatDateTime, formatTime } from '@/lib/utils';

const DAY = 86_400_000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const err = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);

/** Monday 00:00 of the week containing `d`, in the browser's local time. */
function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'border-l-primary bg-secondary/50',
  LIVE: 'border-l-success bg-success/10',
  COMPLETED: 'border-l-border bg-muted/50 text-muted-foreground',
  CANCELLED: 'border-l-destructive bg-destructive/5 text-muted-foreground line-through',
  MISSED: 'border-l-warning bg-warning/10',
};

// ───────────── Schedule a class ─────────────

function ScheduleDialog({ onClose, defaultStart }: { onClose: () => void; defaultStart: Date }) {
  const qc = useQueryClient();
  const courses = useCourses();
  const [courseId, setCourseId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [students, setStudents] = useState<PersonOption[]>([]);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(toLocalInput(defaultStart));
  const [duration, setDuration] = useState(30);
  const [repeat, setRepeat] = useState(1);
  const teacher = useQuery({
    queryKey: ['admin', 'teacher-detail', teacherId],
    queryFn: () => api<{ timezone: string; teacherProfile: { availability: { id: string; dayOfWeek: number; startTime: string; endTime: string }[] } | null }>(`/users/${teacherId}`),
    enabled: !!teacherId,
  });
  const course = courses.data?.find((c) => c.id === courseId);

  const m = useMutation({
    mutationFn: () => api<ClassSessionSummary[]>('/classes', {
      method: 'POST',
      body: {
        courseId, teacherId, studentIds: students.map((s) => s.id),
        title: title.trim() || `${course?.title ?? 'Class'} — ${students.map((s) => s.fullName.split(' ')[0]).join(', ')}`,
        startsAt: new Date(start).toISOString(), durationMinutes: duration, repeatWeeks: repeat,
      },
    }),
    onSuccess: (r) => {
      toast.success(r.length > 1 ? `${r.length} weekly classes scheduled` : 'Class scheduled');
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
      onClose();
    },
    onError: (e) => toast.error(err(e, 'Could not schedule class')),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Schedule a class</DialogTitle><DialogDescription>Teacher and students are notified, and the class appears in their portals. Double bookings are rejected.</DialogDescription></DialogHeader>
        <form id="schedule-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course" htmlFor="sc-course">
              <Select id="sc-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); const c = courses.data?.find((x) => x.id === e.target.value); if (c) setDuration(c.classMinutes); }}>
                <option value="" disabled>Choose a course…</option>
                {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
            </Field>
            <Field label="Teacher" htmlFor="sc-teacher"><TeacherSelect id="sc-teacher" value={teacherId} onChange={setTeacherId} /></Field>
          </div>
          {teacher.data?.teacherProfile?.availability.length ? (
            <div className="text-muted-foreground text-xs">
              Available ({teacher.data.timezone.replace(/_/g, ' ')}):{' '}
              {teacher.data.teacherProfile.availability.map((a) => `${DAYS[a.dayOfWeek]} ${a.startTime}–${a.endTime}`).join(' · ')}
            </div>
          ) : teacherId && teacher.data ? <p className="text-warning text-xs">This teacher has not set any availability.</p> : null}
          <Field label="Students" htmlFor="sc-students" hint="One-to-one classes have a single student; add more for a group class.">
            <StudentPicker id="sc-students" selected={students} onChange={setStudents} />
          </Field>
          <Field label="Title (optional)" htmlFor="sc-title"><Input id="sc-title" placeholder="Generated from course and student names" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Starts (your device time)" htmlFor="sc-start" className="sm:col-span-1"><Input id="sc-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Duration" htmlFor="sc-dur">
              <Select id="sc-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[20, 30, 40, 45, 60, 90].map((n) => <option key={n} value={n}>{n} min</option>)}</Select>
            </Field>
            <Field label="Repeat weekly" htmlFor="sc-rep">
              <Select id="sc-rep" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
                {[1, 4, 8, 12, 24, 52].map((n) => <option key={n} value={n}>{n === 1 ? 'Just once' : `${n} weeks`}</option>)}
              </Select>
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="schedule-form" disabled={m.isPending || !courseId || !teacherId || !students.length || !start}>
            {m.isPending ? <Loader2 className="animate-spin" /> : null} Schedule{repeat > 1 ? ` ${repeat} classes` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Class details / reschedule / cancel ─────────────

type ClassDetail = ClassSessionSummary & {
  teacherNotes: string | null; cancelReason: string | null;
  attendees: { studentId: string; fullName: string; status: string; joinedAt: string | null }[];
};

function ClassDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const tz = user?.timezone;
  const manage = can(user, PERMISSIONS.CLASSES_MANAGE);
  const q = useQuery({ queryKey: ['classes', id], queryFn: () => api<ClassDetail>(`/classes/${id}`) });
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const done = (msg: string) => { toast.success(msg); void qc.invalidateQueries({ queryKey: ['classes'] }); void qc.invalidateQueries({ queryKey: ['admin'] }); onClose(); };

  const reschedule = useMutation({
    mutationFn: () => api(`/classes/${id}/reschedule`, { method: 'PATCH', body: { startsAt: new Date(start).toISOString(), durationMinutes: duration } }),
    onSuccess: () => done('Class rescheduled — teacher and students notified'),
    onError: (e) => toast.error(err(e, 'Could not reschedule')),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/classes/${id}/cancel`, { method: 'POST', body: { reason: reason.trim() } }),
    onSuccess: () => done('Class cancelled — teacher and students notified'),
    onError: (e) => toast.error(err(e, 'Could not cancel')),
  });

  const c = q.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {q.isPending ? <Loader2 className="animate-spin" /> : q.isError ? <ErrorBlock error={q.error} /> : c ? (
          <>
            <DialogHeader>
              <DialogTitle>{c.title}</DialogTitle>
              <DialogDescription>{c.course.title} · {c.teacher.fullName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">{formatDateTime(c.startsAt, tz)} – {formatTime(c.endsAt, tz)} <ClassStatusBadge status={c.status} /></p>
              {c.cancelReason ? <p className="text-destructive">Cancelled: {c.cancelReason}</p> : null}
              <ul className="space-y-1">{c.attendees.map((a) => <li key={a.studentId} className="flex items-center gap-2">{a.fullName} <AttendanceBadge status={a.status} /></li>)}</ul>
              {c.teacherNotes ? <p className="bg-muted rounded-md p-2 text-xs whitespace-pre-line"><span className="font-medium">Teacher notes: </span>{c.teacherNotes}</p> : null}
            </div>

            {mode === 'reschedule' ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <Field label="New start (your device time)" htmlFor="rs-start"><Input id="rs-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
                <Field label="Duration" htmlFor="rs-dur"><Select id="rs-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[20, 30, 40, 45, 60, 90].map((n) => <option key={n} value={n}>{n} min</option>)}</Select></Field>
              </div>
            ) : null}
            {mode === 'cancel' ? <Field label="Reason (sent to teacher and students)" htmlFor="cx-reason"><Textarea id="cx-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field> : null}

            <DialogFooter className="flex-wrap">
              {c.canJoin ? <Button variant="outline" asChild><Link href={`/classroom/${c.id}`}><Video /> Observe</Link></Button> : null}
              {manage && c.status === 'SCHEDULED' && mode === 'view' ? (
                <>
                  <Button variant="outline" onClick={() => { setStart(toLocalInput(new Date(c.startsAt))); setDuration(Math.round((+new Date(c.endsAt) - +new Date(c.startsAt)) / 60_000)); setMode('reschedule'); }}>Reschedule</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => setMode('cancel')}>Cancel class</Button>
                </>
              ) : null}
              {mode === 'reschedule' ? <Button onClick={() => reschedule.mutate()} disabled={reschedule.isPending || !start}>{reschedule.isPending ? <Loader2 className="animate-spin" /> : null} Save new time</Button> : null}
              {mode === 'cancel' ? <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending || reason.trim().length < 3}>{cancel.isPending ? <Loader2 className="animate-spin" /> : null} Confirm cancellation</Button> : null}
              {mode !== 'view' ? <Button variant="ghost" onClick={() => setMode('view')}>Back</Button> : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Week calendar ─────────────

function Schedule() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const params = useSearchParams();
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const [teacherId, setTeacherId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const creating = params.get('new') === '1';
  const [createAt, setCreateAt] = useState<Date | null>(null);
  const from = anchor;
  const to = new Date(anchor.getTime() + 7 * DAY);

  const q = useQuery({
    queryKey: ['classes', 'admin-week', from.toISOString(), teacherId],
    queryFn: () => api<ClassSessionSummary[]>(`/classes?from=${from.toISOString()}&to=${to.toISOString()}&limit=200${teacherId ? `&teacherId=${teacherId}` : ''}`),
    refetchInterval: 60_000,
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(from.getTime() + i * DAY)), [from]);
  const today = new Date().toDateString();
  const byDay = (d: Date) => (q.data ?? []).filter((c) => new Date(c.startsAt).toDateString() === d.toDateString());
  const label = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const newAt = (d: Date) => { const x = new Date(d); x.setHours(17, 0, 0, 0); return x; };
  const counts = (q.data ?? []).reduce<Record<string, number>>((acc, c) => ((acc[c.status] = (acc[c.status] ?? 0) + 1), acc), {});

  return (
    <>
      <PageTitle
        title="Schedule"
        description="All classes in the academy. Shown in your device’s time zone; each person sees their own local time."
        actions={can(user, PERMISSIONS.CLASSES_MANAGE) ? <Button onClick={() => setCreateAt(newAt(new Date(Math.max(Date.now() + DAY, from.getTime()))))}><CalendarPlus /> Schedule a class</Button> : null}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setAnchor(new Date(anchor.getTime() - 7 * DAY))}><ChevronLeft /></Button>
        <Button variant="outline" onClick={() => setAnchor(weekStart(new Date()))}>This week</Button>
        <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setAnchor(new Date(anchor.getTime() + 7 * DAY))}><ChevronRight /></Button>
        <span className="ml-1 font-semibold">{label.format(from)} – {label.format(new Date(to.getTime() - DAY))} {from.getFullYear()}</span>
        <div className="ml-auto w-56"><TeacherSelect value={teacherId} onChange={setTeacherId} allowEmpty emptyLabel="All teachers" /></div>
      </div>
      <p className="text-muted-foreground mb-3 flex flex-wrap gap-x-4 text-xs">
        <span>{q.data?.length ?? 0} classes this week</span>
        {Object.entries(counts).map(([s, n]) => <span key={s}>{n} {s.toLowerCase()}</span>)}
      </p>

      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const items = byDay(d);
            const isToday = d.toDateString() === today;
            return (
              <section key={d.toISOString()} className={cn('bg-card min-h-40 rounded-lg border p-2', isToday && 'border-primary ring-primary/20 ring-2')} aria-label={d.toDateString()}>
                <header className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className={cn('text-sm font-semibold', isToday && 'text-primary')}>{DAYS[d.getDay()]} <span className="text-muted-foreground font-normal">{d.getDate()}</span></h2>
                  {items.length ? <Badge variant="secondary">{items.length}</Badge> : null}
                </header>
                <ul className="space-y-1.5">
                  {items.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setOpenId(c.id)} className={cn('w-full rounded-md border-l-4 px-2 py-1.5 text-left text-xs transition-colors hover:brightness-95', STATUS_STYLE[c.status])}>
                        <span className="font-semibold tabular-nums">{formatTime(c.startsAt)}</span>
                        <span className="block truncate font-medium">{c.title}</span>
                        <span className="text-muted-foreground block truncate">{c.teacher.fullName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {can(user, PERMISSIONS.CLASSES_MANAGE) && d.getTime() + DAY > Date.now() ? (
                  <button type="button" onClick={() => setCreateAt(newAt(d))} className="text-muted-foreground hover:text-primary mt-1 w-full rounded px-1 py-1 text-left text-xs">+ Add</button>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {openId ? <ClassDialog id={openId} onClose={() => setOpenId(null)} /> : null}
      {createAt || creating ? (
        <ScheduleDialog defaultStart={createAt ?? newAt(new Date(Date.now() + DAY))} onClose={() => { setCreateAt(null); if (creating) router.replace('/admin/schedule'); }} />
      ) : null}
    </>
  );
}

export default function AdminSchedulePage() {
  return <Suspense><Schedule /></Suspense>;
}
