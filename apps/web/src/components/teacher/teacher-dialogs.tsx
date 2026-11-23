'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { api, ApiError } from '@/lib/api';
import { PROGRESS_TYPES, SURAHS, type ProgressType } from '@/lib/quran';
import { cn, formatDateTime } from '@/lib/utils';

const err = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);

/** Refresh everything a teacher action can affect. */
function useTeacherInvalidate() {
  const qc = useQueryClient();
  return () => {
    for (const key of [['teacher'], ['classes'], ['progress'], ['homework']]) void qc.invalidateQueries({ queryKey: key });
  };
}

// ───────────── Record Quran progress ─────────────

export function RecordProgressDialog({ student, onClose }: { student: { id: string; fullName: string }; onClose: () => void }) {
  const invalidate = useTeacherInvalidate();
  const [type, setType] = useState<ProgressType>('MEMORIZATION');
  const [surah, setSurah] = useState(67);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(5);
  const [qaidaLesson, setQaidaLesson] = useState(1);
  const [rating, setRating] = useState(4);
  const [notes, setNotes] = useState('');
  const max = SURAHS[surah - 1]?.ayahs ?? 1;
  const qaida = type === 'QAIDA';
  const valid = qaida ? qaidaLesson >= 1 : from >= 1 && to <= max && from <= to;

  const m = useMutation({
    mutationFn: () =>
      api('/progress', {
        method: 'POST',
        body: {
          studentId: student.id, type, rating, notes: notes.trim() || undefined,
          ...(qaida ? { surah: 0, ayahFrom: 0, ayahTo: 0, qaidaLesson } : { surah, ayahFrom: from, ayahTo: to }),
        },
      }),
    onSuccess: () => { toast.success(`Progress recorded for ${student.fullName}`); invalidate(); onClose(); },
    onError: (e) => toast.error(err(e, 'Could not record progress')),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record progress — {student.fullName}</DialogTitle>
          <DialogDescription>The student and their parents see this in their progress log.</DialogDescription>
        </DialogHeader>
        <form id="progress-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Field label="Type" htmlFor="pr-type">
            <Select id="pr-type" value={type} onChange={(e) => setType(e.target.value as ProgressType)}>
              {Object.entries(PROGRESS_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          {qaida ? (
            <Field label="Qaida lesson number" htmlFor="pr-qaida"><Input id="pr-qaida" type="number" min={1} max={60} value={qaidaLesson} onChange={(e) => setQaidaLesson(Number(e.target.value))} /></Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_90px_90px]">
              <Field label="Surah" htmlFor="pr-surah">
                <Select id="pr-surah" value={surah} onChange={(e) => { const n = Number(e.target.value); setSurah(n); setFrom(1); setTo(Math.min(5, SURAHS[n - 1]!.ayahs)); }}>
                  {SURAHS.map((s) => <option key={s.n} value={s.n}>{s.n}. {s.name} ({s.ayahs})</option>)}
                </Select>
              </Field>
              <Field label="From ayah" htmlFor="pr-from"><Input id="pr-from" type="number" min={1} max={max} value={from} onChange={(e) => setFrom(Number(e.target.value))} /></Field>
              <Field label="To ayah" htmlFor="pr-to"><Input id="pr-to" type="number" min={1} max={max} value={to} onChange={(e) => setTo(Number(e.target.value))} /></Field>
            </div>
          )}
          {!valid ? <p className="text-destructive text-xs">{qaida ? 'Enter a lesson number.' : `Choose an ayah range within 1–${max}.`}</p> : null}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Rating</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n} className="rounded p-0.5">
                  <Star className={cn('size-6', n <= rating ? 'fill-gold text-gold' : 'text-border')} />
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Notes for the student (optional)" htmlFor="pr-notes"><Textarea id="pr-notes" rows={3} placeholder="e.g. Good ikhfa; revise qalqalah on ق and ط" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="progress-form" disabled={!valid || m.isPending}>{m.isPending ? <Loader2 className="animate-spin" /> : null} Save progress</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Assign homework ─────────────

export function AssignHomeworkDialog({ student, classSession, onClose }: {
  student: { id: string; fullName: string };
  /** When assigned from a class, the course is fixed to the class's course. */
  classSession?: { id: string; course: { id: string; title: string } };
  onClose: () => void;
}) {
  const invalidate = useTeacherInvalidate();
  const courses = useQuery({
    queryKey: ['teacher', 'student-courses', student.id],
    queryFn: () => api<{ id: string; title: string }[]>(`/teachers/me/students/${student.id}/courses`),
    enabled: !classSession,
  });
  const options = classSession ? [classSession.course] : courses.data ?? [];
  const [courseId, setCourseId] = useState(classSession?.course.id ?? '');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [due, setDue] = useState(() => {
    const d = new Date(Date.now() + 3 * 86_400_000);
    d.setHours(18, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const selectedCourse = courseId || options[0]?.id || '';

  const m = useMutation({
    mutationFn: () => api('/homework', {
      method: 'POST',
      body: { studentId: student.id, courseId: selectedCourse, classSessionId: classSession?.id, title: title.trim(), instructions: instructions.trim(), dueAt: due ? new Date(due).toISOString() : undefined },
    }),
    onSuccess: () => { toast.success(`Homework assigned to ${student.fullName}`); invalidate(); onClose(); },
    onError: (e) => toast.error(err(e, 'Could not assign homework')),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign homework — {student.fullName}</DialogTitle></DialogHeader>
        <form id="hw-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Field label="Course" htmlFor="hw-course">
            <Select id="hw-course" value={selectedCourse} disabled={!!classSession} onChange={(e) => setCourseId(e.target.value)}>
              {options.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
          <Field label="Title" htmlFor="hw-title"><Input id="hw-title" placeholder="Revise Surah Al-Mulk 1–10" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Instructions" htmlFor="hw-inst"><Textarea id="hw-inst" rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
          <Field label="Due (your time)" htmlFor="hw-due"><Input id="hw-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="hw-form" disabled={m.isPending || !selectedCourse || title.trim().length < 2 || instructions.trim().length < 2}>
            {m.isPending ? <Loader2 className="animate-spin" /> : null} Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Review homework ─────────────

export type TeachingHomework = {
  id: string; title: string; instructions: string; status: string; dueAt: string | null; updatedAt: string;
  student: { id: string; fullName: string }; course: { title: string };
  submissions: { id: string; content: string | null; storageKey: string | null; submittedAt: string; grade: number | null; feedback: string | null; reviewedAt: string | null }[];
};

export function ReviewHomeworkDialog({ homework, onClose }: { homework: TeachingHomework; onClose: () => void }) {
  const invalidate = useTeacherInvalidate();
  const sub = homework.submissions[0];
  const [grade, setGrade] = useState(sub?.grade ?? 80);
  const [feedback, setFeedback] = useState(sub?.feedback ?? '');
  const m = useMutation({
    mutationFn: () => api(`/homework/${homework.id}/review`, { method: 'PATCH', body: { grade, feedback: feedback.trim() } }),
    onSuccess: () => { toast.success('Feedback sent'); invalidate(); onClose(); },
    onError: (e) => toast.error(err(e, 'Could not save review')),
  });
  const openAttachment = async () => {
    try {
      const { url } = await api<{ url: string }>(`/homework/submissions/${sub!.id}/attachment`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(err(e, 'Could not open attachment'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{homework.title}</DialogTitle>
          <DialogDescription>{homework.student.fullName} · {homework.course.title}{sub ? ` · submitted ${formatDateTime(sub.submittedAt)}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted/60 rounded-md p-3 text-sm whitespace-pre-line"><span className="font-medium">Task: </span>{homework.instructions}</div>
        {sub ? (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">Student’s answer</p>
            {sub.content ? <p className="whitespace-pre-line">{sub.content}</p> : <p className="text-muted-foreground">No written answer.</p>}
            {sub.storageKey ? <Button size="sm" variant="outline" onClick={openAttachment}><FileText /> Open attachment</Button> : null}
          </div>
        ) : <p className="text-muted-foreground text-sm">Nothing submitted yet.</p>}
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Field label="Grade (0–100)" htmlFor="rv-grade"><Input id="rv-grade" type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(Number(e.target.value))} /></Field>
          <Field label="Feedback" htmlFor="rv-feedback"><Textarea id="rv-feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => m.mutate()} disabled={!sub || m.isPending || !feedback.trim() || grade < 0 || grade > 100}>
            {m.isPending ? <Loader2 className="animate-spin" /> : null} Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
