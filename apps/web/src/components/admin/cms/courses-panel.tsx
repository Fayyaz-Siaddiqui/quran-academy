'use client';

import { PERMISSIONS } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { coursePath, DEDICATED_COURSE_PATHS } from '@/components/site/sections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { CharCount, useCmsMutation } from './cms-shared';

const CATEGORIES = {
  NOORANI_QAIDA: 'Noorani Qaida', QURAN_READING: 'Quran Reading', QURAN_MEMORIZATION: 'Quran Memorization',
  TAJWEED: 'Tajweed', ISLAMIC_STUDIES: 'Islamic Studies', KIDS: 'Kids', ARABIC: 'Arabic',
} as const;

type Lesson = { id: string; title: string; summary: string | null; content: string | null; sortOrder: number };
type Course = {
  id: string; slug: string; title: string; category: keyof typeof CATEGORIES; level: string; shortDescription: string; description: string;
  outcomes: string[]; ageGroup: string | null; durationWeeks: number | null; classMinutes: number; imageUrl: string | null;
  isPublished: boolean; sortOrder: number; metaTitle: string | null; metaDescription: string | null; updatedAt?: string;
  _count?: { enrollments: number; lessons?: number };
};
type CourseDetail = Course & { lessons: Lesson[] };
type Form = {
  slug: string; title: string; category: keyof typeof CATEGORIES; level: string; shortDescription: string; description: string; outcomes: string;
  ageGroup: string; durationWeeks: string; classMinutes: number; imageUrl: string; isPublished: boolean; metaTitle: string; metaDescription: string;
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const toForm = (c?: Course): Form => ({
  slug: c?.slug ?? '', title: c?.title ?? '', category: c?.category ?? 'QURAN_READING', level: c?.level ?? 'All levels',
  shortDescription: c?.shortDescription ?? '', description: c?.description ?? '', outcomes: c?.outcomes.join('\n') ?? '',
  ageGroup: c?.ageGroup ?? '', durationWeeks: c?.durationWeeks?.toString() ?? '', classMinutes: c?.classMinutes ?? 30,
  imageUrl: c?.imageUrl ?? '', isPublished: c?.isPublished ?? false, metaTitle: c?.metaTitle ?? '', metaDescription: c?.metaDescription ?? '',
});

function LessonsCard({ course }: { course: CourseDetail }) {
  const key = ['cms', 'course', course.id];
  const [editing, setEditing] = useState<{ lesson: Lesson | null; title: string; summary: string; content: string } | null>(null);
  const lessons = course.lessons;
  // null (not undefined) so clearing a summary or notes actually clears it.
  const body = (l: Pick<Lesson, 'title' | 'summary' | 'content'>, sortOrder: number) => ({ title: l.title, summary: l.summary || null, content: l.content || null, sortOrder });

  const save = useCmsMutation(
    () => {
      const e = editing!;
      const data = { title: e.title, summary: e.summary, content: e.content };
      return e.lesson
        ? api(`/courses/${course.id}/lessons/${e.lesson.id}`, { method: 'PATCH', body: body(data, e.lesson.sortOrder) })
        : api(`/courses/${course.id}/lessons`, { method: 'POST', body: body(data, Math.max(0, ...lessons.map((l) => l.sortOrder)) + 1) });
    },
    { queryKey: key, success: 'Lesson saved', onSuccess: () => setEditing(null) },
  );
  // Lesson numbers are unique per course, so swaps go through a temporary slot.
  const move = useCmsMutation(
    async ({ a, b }: { a: Lesson; b: Lesson }) => {
      const path = (l: Lesson) => `/courses/${course.id}/lessons/${l.id}`;
      await api(path(a), { method: 'PATCH', body: body(a, 999_999) });
      await api(path(b), { method: 'PATCH', body: body(b, a.sortOrder) });
      await api(path(a), { method: 'PATCH', body: body(a, b.sortOrder) });
    },
    { queryKey: key, success: 'Order updated' },
  );
  const remove = useCmsMutation((l: Lesson) => api(`/courses/${course.id}/lessons/${l.id}`, { method: 'DELETE' }), { queryKey: key, success: 'Lesson removed' });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Curriculum</CardTitle><CardDescription>Shown on the course page and to enrolled students.</CardDescription></div>
        <Button size="sm" variant="outline" onClick={() => setEditing({ lesson: null, title: '', summary: '', content: '' })}><Plus /> Add lesson</Button>
      </CardHeader>
      <CardContent>
        {lessons.length ? (
          <ol className="divide-y rounded-lg border">
            {lessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                <span className="text-primary w-6 text-sm font-semibold tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  {l.summary ? <p className="text-muted-foreground truncate text-xs">{l.summary}</p> : null}
                </div>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Move up" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ a: l, b: lessons[i - 1]! })}><ArrowUp /></Button>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Move down" disabled={i === lessons.length - 1 || move.isPending} onClick={() => move.mutate({ a: l, b: lessons[i + 1]! })}><ArrowDown /></Button>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Edit lesson" onClick={() => setEditing({ lesson: l, title: l.title, summary: l.summary ?? '', content: l.content ?? '' })}><Pencil /></Button>
                <Button variant="ghost" size="icon" className="text-destructive size-7" aria-label="Delete lesson"
                  onClick={() => confirm(`Remove "${l.title}"? Students' completion records for it are deleted too.`) && remove.mutate(l)}><Trash2 /></Button>
              </li>
            ))}
          </ol>
        ) : <EmptyState icon={BookOpen} title="No lessons yet" />}
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.lesson ? 'Edit lesson' : 'New lesson'}</DialogTitle></DialogHeader>
          {editing ? (
            <form id="lesson-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
              <Field label="Title" htmlFor="l-title"><Input id="l-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Summary (shown in the curriculum list)" htmlFor="l-sum"><Input id="l-sum" value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} /></Field>
              <Field label="Lesson notes for students (Markdown, optional)" htmlFor="l-content"><Textarea id="l-content" rows={10} className="font-mono text-sm" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></Field>
            </form>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" form="lesson-form" disabled={!editing || editing.title.trim().length < 2 || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null} Save lesson</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CourseEditor({ id, onDone }: { id: string | null; onDone: (newId?: string) => void }) {
  const canManage = can(useAuthStore((s) => s.user), PERMISSIONS.COURSES_MANAGE);
  const q = useQuery({ queryKey: ['cms', 'course', id], queryFn: () => api<CourseDetail>(`/courses/${id}`), enabled: !!id });
  if (id && q.isPending) return <LoadingBlock />;
  if (id && q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  return <CourseForm key={q.data?.updatedAt ?? id ?? 'new'} course={q.data} onDone={onDone} canManage={canManage} />;
}

function CourseForm({ course, onDone, canManage }: { course?: CourseDetail; onDone: (newId?: string) => void; canManage: boolean }) {
  const [f, setF] = useState<Form>(() => toForm(course));
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  // Core courses have dedicated landing URLs (e.g. /tajweed) that depend on the slug.
  const slugLocked = !!course && DEDICATED_COURSE_PATHS.has(course.slug);

  const save = useCmsMutation(
    () => {
      const body = {
        ...(slugLocked ? {} : { slug: f.slug }),
        title: f.title.trim(), category: f.category, level: f.level.trim() || 'All levels',
        shortDescription: f.shortDescription.trim(), description: f.description.trim(),
        outcomes: f.outcomes.split('\n').map((o) => o.trim()).filter(Boolean),
        ageGroup: f.ageGroup.trim() || null, durationWeeks: f.durationWeeks ? Number(f.durationWeeks) : null,
        classMinutes: f.classMinutes, imageUrl: f.imageUrl || null, isPublished: f.isPublished,
        metaTitle: f.metaTitle || null, metaDescription: f.metaDescription || null,
      };
      return course ? api<Course>(`/courses/${course.id}`, { method: 'PATCH', body }) : api<Course>('/courses', { method: 'POST', body });
    },
    { queryKey: ['cms'], success: course ? 'Course saved' : 'Course created', onSuccess: (c) => !course && onDone(c.id) },
  );
  const remove = useCmsMutation(() => api(`/courses/${course!.id}`, { method: 'DELETE' }), { queryKey: ['cms', 'courses'], success: 'Course deleted', onSuccess: () => onDone() });

  const problems = [
    f.title.trim().length < 2 && 'a title',
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug) && 'a valid slug',
    (f.shortDescription.trim().length < 10 || f.shortDescription.length > 300) && 'a short description (10–300 characters)',
    f.description.trim().length < 10 && 'a full description',
    (f.metaTitle.length > 70 || f.metaDescription.length > 170) && 'shorter SEO fields',
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onDone()}><ArrowLeft /> All courses</Button>
        {course?.isPublished ? <a href={coursePath(course.slug)} target="_blank" rel="noreferrer" className="text-primary ml-auto inline-flex items-center gap-1 text-sm hover:underline">View page <ExternalLink className="size-3" /></a> : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <form className="grid content-start gap-6" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <fieldset disabled={!canManage} className="contents">
            <Card>
              <CardHeader><CardTitle>{course ? course.title : 'New course'}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" htmlFor="c-title" className="sm:col-span-2">
                  <Input id="c-title" value={f.title} onChange={(e) => set({ title: e.target.value, ...(course ? {} : { slug: slugify(e.target.value) }) })} />
                </Field>
                <Field label="URL slug" htmlFor="c-slug" hint={slugLocked ? `Fixed: this course has its own page at ${coursePath(f.slug)}` : `Page: ${coursePath(f.slug || '…')}`}>
                  <Input id="c-slug" value={f.slug} disabled={slugLocked} onChange={(e) => set({ slug: slugify(e.target.value) })} />
                </Field>
                <Field label="Category" htmlFor="c-cat">
                  <Select id="c-cat" value={f.category} onChange={(e) => set({ category: e.target.value as Form['category'] })}>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                <Field label="Level" htmlFor="c-level"><Input id="c-level" value={f.level} onChange={(e) => set({ level: e.target.value })} /></Field>
                <Field label="Suitable for" htmlFor="c-age"><Input id="c-age" placeholder="4–12 years" value={f.ageGroup} onChange={(e) => set({ ageGroup: e.target.value })} /></Field>
                <Field label="Class length (minutes)" htmlFor="c-min"><Input id="c-min" type="number" min={15} max={180} step={5} value={f.classMinutes} onChange={(e) => set({ classMinutes: Number(e.target.value) })} /></Field>
                <Field label="Typical duration (weeks, optional)" htmlFor="c-weeks"><Input id="c-weeks" type="number" min={1} max={520} value={f.durationWeeks} onChange={(e) => set({ durationWeeks: e.target.value })} /></Field>
                <Field label="Short description" htmlFor="c-short" className="sm:col-span-2" hint="Course cards and page intro">
                  <Textarea id="c-short" rows={2} value={f.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />
                  <p className="text-right text-xs"><CharCount value={f.shortDescription} max={300} /></p>
                </Field>
                <Field label="Full description" htmlFor="c-desc" className="sm:col-span-2" hint="Blank line between paragraphs">
                  <Textarea id="c-desc" rows={7} value={f.description} onChange={(e) => set({ description: e.target.value })} />
                </Field>
                <Field label="What students will achieve" htmlFor="c-out" className="sm:col-span-2" hint="One outcome per line">
                  <Textarea id="c-out" rows={4} value={f.outcomes} onChange={(e) => set({ outcomes: e.target.value })} />
                </Field>
                <Field label="Image URL (optional)" htmlFor="c-img" className="sm:col-span-2"><Input id="c-img" type="url" value={f.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} /></Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <Field label="SEO title" htmlFor="c-mt">
                  <Input id="c-mt" placeholder={`${f.title} Online Classes`} value={f.metaTitle} onChange={(e) => set({ metaTitle: e.target.value })} />
                  <p className="text-right text-xs"><CharCount value={f.metaTitle} max={70} /></p>
                </Field>
                <Field label="Meta description" htmlFor="c-md">
                  <Textarea id="c-md" rows={2} placeholder={f.shortDescription} value={f.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} />
                  <p className="text-right text-xs"><CharCount value={f.metaDescription} max={170} /></p>
                </Field>
              </CardContent>
            </Card>
            {canManage ? (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} /> Published on the website</label>
                <Button type="submit" disabled={problems.length > 0 || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null} {course ? 'Save course' : 'Create course'}</Button>
                {course ? (
                  <Button type="button" variant="ghost" className="text-destructive ml-auto" disabled={remove.isPending}
                    onClick={() => confirm('Delete this course? Courses that already have classes cannot be deleted — unpublish them instead.') && remove.mutate(undefined)}>
                    <Trash2 /> Delete
                  </Button>
                ) : null}
                {problems.length ? <p className="text-muted-foreground w-full text-xs">Still needed: {problems.join(', ')}.</p> : null}
              </div>
            ) : null}
          </fieldset>
        </form>
        {course ? (canManage ? <LessonsCard course={course} /> : null) : (
          <Card><CardContent className="text-muted-foreground text-sm">Create the course first, then add its lessons.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

export function CoursesPanel() {
  const q = useQuery({ queryKey: ['cms', 'courses'], queryFn: () => api<(Course & { _count: { enrollments: number; lessons: number } })[]>('/courses') });
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const canManage = can(useAuthStore((s) => s.user), PERMISSIONS.COURSES_MANAGE);

  if (editing) return <CourseEditor id={editing.id} onDone={(newId) => setEditing(newId ? { id: newId } : null)} />;
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{q.data.length} courses · {q.data.filter((c) => c.isPublished).length} published</p>
        {canManage ? <Button onClick={() => setEditing({ id: null })}><Plus /> New course</Button> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {q.data.map((c) => (
          <button key={c.id} type="button" onClick={() => setEditing({ id: c.id })} className="text-left">
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">{c.title}{c.isPublished ? <Badge variant="success">published</Badge> : <Badge variant="secondary">draft</Badge>}</CardTitle>
                <CardDescription>{CATEGORIES[c.category]} · {coursePath(c.slug)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground line-clamp-2 text-sm">{c.shortDescription}</p>
                <p className="text-xs">{c._count.lessons} lessons · {c._count.enrollments} enrolments</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </>
  );
}
