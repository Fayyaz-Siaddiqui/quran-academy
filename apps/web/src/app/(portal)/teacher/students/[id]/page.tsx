'use client';

import type { ClassSessionSummary } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { ClassRow } from '@/components/portal/class-row';
import { ProgressView } from '@/components/portal/progress-view';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { AssignHomeworkDialog, RecordProgressDialog, ReviewHomeworkDialog, type TeachingHomework } from '@/components/teacher/teacher-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger, UserAvatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';

type Profile = {
  fullName: string; country: string | null; timezone: string; preferredLanguage: string | null;
  studentProfile: { dateOfBirth: string | null; preferredClassTiming: string | null; level: string | null; guardianName: string | null; guardianRelationship: string | null } | null;
  parents: { id: string; fullName: string }[];
};
type StudentHomework = Omit<TeachingHomework, 'student'> & { teacher: { id: string } };

const HW_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = { ASSIGNED: 'secondary', SUBMITTED: 'warning', REVIEWED: 'success', OVERDUE: 'destructive' };

export default function TeacherStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAuthStore((s) => s.user);
  const tz = me?.timezone ?? 'UTC';
  const [dialog, setDialog] = useState<'progress' | 'homework' | { review: TeachingHomework } | null>(null);

  const profile = useQuery({ queryKey: ['teacher', 'student', id], queryFn: () => api<Profile>(`/students/${id}/profile`) });
  const classes = useQuery({ queryKey: ['classes', 'student', id], queryFn: () => api<ClassSessionSummary[]>(`/classes?studentId=${id}&scope=upcoming&limit=10`) });
  const homework = useQuery({ queryKey: ['homework', 'student', id], queryFn: () => api<StudentHomework[]>(`/students/${id}/homework`) });

  if (profile.isPending) return <LoadingBlock />;
  if (profile.isError) return <ErrorBlock error={profile.error} retry={() => profile.refetch()} />;
  const p = profile.data;
  const student = { id, fullName: p.fullName };
  const age = p.studentProfile?.dateOfBirth ? Math.floor((Date.now() - new Date(p.studentProfile.dateOfBirth).getTime()) / (365.25 * 86_400_000)) : null;
  // Only the teacher who set a piece of homework may review it.
  const mine = (homework.data ?? []).filter((h) => h.teacher.id === me?.id);

  return (
    <div className="space-y-6">
      <Link href="/teacher/students" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="size-4" /> My students</Link>

      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar name={p.fullName} className="size-14" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{p.fullName}</h1>
          <p className="text-muted-foreground text-sm">
            {[age !== null ? `${age} years` : null, p.country, `local time zone ${p.timezone.replace(/_/g, ' ')}`, p.preferredLanguage].filter(Boolean).join(' · ')}
          </p>
          {p.parents.length || p.studentProfile?.guardianName ? (
            <p className="text-muted-foreground text-xs">Guardian: {p.parents.map((x) => x.fullName).join(', ') || `${p.studentProfile?.guardianName} (${p.studentProfile?.guardianRelationship})`}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDialog('progress')}><TrendingUp /> Record progress</Button>
          <Button variant="outline" onClick={() => setDialog('homework')}><ClipboardList /> Assign homework</Button>
        </div>
      </div>

      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">Quran progress</TabsTrigger>
          <TabsTrigger value="homework">Homework {mine.filter((h) => h.status === 'SUBMITTED').length ? `(${mine.filter((h) => h.status === 'SUBMITTED').length})` : ''}</TabsTrigger>
          <TabsTrigger value="classes">Upcoming classes</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="mt-4"><ProgressView studentId={id} /></TabsContent>

        <TabsContent value="homework" className="mt-4">
          <Card>
            <CardContent>
              {homework.isPending ? <LoadingBlock /> : homework.isError ? <ErrorBlock error={homework.error} /> : homework.data.length ? (
                <ul className="divide-y">
                  {homework.data.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{h.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {h.course.title}{h.dueAt ? ` · due ${formatDateTime(h.dueAt, tz)}` : ''}
                          {h.submissions[0]?.grade != null ? ` · graded ${h.submissions[0].grade}/100` : ''}
                        </p>
                      </div>
                      <Badge variant={HW_VARIANT[h.status] ?? 'secondary'}>{h.status.toLowerCase()}</Badge>
                      {h.teacher.id === me?.id && (h.status === 'SUBMITTED' || h.status === 'REVIEWED') ? (
                        <Button size="sm" variant={h.status === 'SUBMITTED' ? 'default' : 'outline'} onClick={() => setDialog({ review: { ...h, student } })}>
                          {h.status === 'SUBMITTED' ? 'Review' : 'View'}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={ClipboardList} title="No homework yet" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Upcoming classes with you</CardTitle></CardHeader>
            <CardContent>
              {classes.isPending ? <LoadingBlock /> : classes.data?.length ? (
                <ul className="divide-y">{classes.data.map((c) => <ClassRow key={c.id} cls={c} timezone={tz} href={`/teacher/classes/${c.id}`} />)}</ul>
              ) : <p className="text-muted-foreground text-sm">None scheduled.</p>}
              {p.studentProfile?.preferredClassTiming ? <p className="text-muted-foreground mt-3 text-xs">Preferred class time: {p.studentProfile.preferredClassTiming.replace('-', ' ')}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {dialog === 'progress' ? <RecordProgressDialog student={student} onClose={() => setDialog(null)} /> : null}
      {dialog === 'homework' ? <AssignHomeworkDialog student={student} onClose={() => setDialog(null)} /> : null}
      {dialog && typeof dialog === 'object' ? <ReviewHomeworkDialog homework={dialog.review} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
