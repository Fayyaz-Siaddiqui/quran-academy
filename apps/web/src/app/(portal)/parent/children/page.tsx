'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { childSchema, CLASS_TIMINGS, LANGUAGES } from '@qa/shared-validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CLASS_TIMING_LABELS, CourseSelect } from '@/components/forms/pickers';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { Badge, EmptyState, UserAvatar } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';

type Child = {
  id: string; fullName: string; email: string | null; hasLogin: boolean; status: string;
  studentProfile: { dateOfBirth: string | null; preferredClassTiming: string | null; preferredCourse: { title: string } | null } | null;
  studentEnrollments: { status: string; course: { title: string }; teacher: { fullName: string } | null }[];
};

function AddChildDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ['public-courses'], queryFn: () => api<{ slug: string; title: string }[]>('/public/courses', { auth: false }) });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(childSchema),
    defaultValues: { preferredLanguage: 'English', preferredClassTiming: 'evening' as const },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api('/parents/me/children', { method: 'POST', body: { ...v, email: v.email || undefined } });
      toast.success(`${v.fullName} added`);
      reset();
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ['children'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add child');
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a child</DialogTitle><DialogDescription>Our team will contact you to arrange an assessment and schedule classes.</DialogDescription></DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Full name" htmlFor="ch-name" error={errors.fullName?.message}><Input id="ch-name" {...register('fullName')} /></Field>
          <Field label="Date of birth" htmlFor="ch-dob" error={errors.dateOfBirth?.message}><Input id="ch-dob" type="date" {...register('dateOfBirth')} /></Field>
          <Field label="Course" htmlFor="ch-course" error={errors.preferredCourseSlug?.message}><CourseSelect id="ch-course" courses={courses.data ?? []} {...register('preferredCourseSlug')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class timing" htmlFor="ch-timing"><Select id="ch-timing" {...register('preferredClassTiming')}>{CLASS_TIMINGS.map((t) => <option key={t} value={t}>{CLASS_TIMING_LABELS[t]}</option>)}</Select></Field>
            <Field label="Language" htmlFor="ch-lang"><Select id="ch-lang" {...register('preferredLanguage')}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</Select></Field>
          </div>
          <Field label="Child’s own email (optional)" htmlFor="ch-email" error={errors.email?.message} hint="For older children who will sign in themselves"><Input id="ch-email" type="email" {...register('email')} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : null} Add child</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EnableLoginDialog({ child, onClose }: { child: Child; onClose: () => void }) {
  const [email, setEmail] = useState(child.email ?? '');
  const m = useMutation({
    mutationFn: () => api(`/parents/me/children/${child.id}/enable-login`, { method: 'POST', body: { email } }),
    onSuccess: () => { toast.success(`A set-password link was sent to ${email}`); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not enable login'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Give {child.fullName} their own login</DialogTitle><DialogDescription>We will email a link so they can choose a password. You keep full access from your parent portal.</DialogDescription></DialogHeader>
        <Field label="Child’s email" htmlFor="el-email"><Input id="el-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending || !email.includes('@')}>Send link</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ParentPage() {
  const [adding, setAdding] = useState(false);
  const [loginFor, setLoginFor] = useState<Child | null>(null);
  const q = useQuery({ queryKey: ['children'], queryFn: () => api<Child[]>('/parents/me/children') });

  return (
    <>
      <PageTitle title="My children" description="Follow each child’s classes, attendance, homework and Quran progress." actions={<Button onClick={() => setAdding(true)}><Plus /> Add child</Button>} />
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : q.data.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center gap-3">
                <UserAvatar name={c.fullName} className="size-11" />
                <div className="min-w-0">
                  <CardTitle className="truncate">{c.fullName}</CardTitle>
                  <CardDescription>{c.hasLogin ? 'Has own login' : 'Managed by you'}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.studentEnrollments.length ? (
                  <ul className="space-y-1 text-sm">{c.studentEnrollments.map((e, i) => <li key={i}><span className="font-medium">{e.course.title}</span>{e.teacher ? <span className="text-muted-foreground"> · {e.teacher.fullName}</span> : null}</li>)}</ul>
                ) : (
                  <p className="text-sm"><Badge variant="warning">Awaiting enrolment</Badge> {c.studentProfile?.preferredCourse ? <span className="text-muted-foreground">for {c.studentProfile.preferredCourse.title}</span> : null}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild><Link href={`/parent/children/${c.id}`}>View dashboard</Link></Button>
                  {!c.hasLogin ? <Button size="sm" variant="outline" onClick={() => setLoginFor(c)}><KeyRound /> Enable login</Button> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={Users} title="No children added yet" action={<Button className="mt-2" onClick={() => setAdding(true)}><Plus /> Add your first child</Button>} />}
      <AddChildDialog open={adding} onOpenChange={setAdding} />
      {loginFor ? <EnableLoginDialog child={loginFor} onClose={() => setLoginFor(null)} /> : null}
    </>
  );
}
