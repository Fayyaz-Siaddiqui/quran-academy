'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { ReviewHomeworkDialog, type TeachingHomework } from '@/components/teacher/teacher-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, EmptyState, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';

const FILTERS = { SUBMITTED: 'To review', ASSIGNED: 'Waiting on students', OVERDUE: 'Overdue', REVIEWED: 'Reviewed' } as const;
type Filter = keyof typeof FILTERS;

export default function TeacherHomeworkPage() {
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  const [reviewing, setReviewing] = useState<TeachingHomework | null>(null);
  const q = useQuery({ queryKey: ['teacher', 'homework', filter], queryFn: () => api<TeachingHomework[]>(`/homework/teaching?status=${filter}`) });

  return (
    <>
      <PageTitle title="Homework" description="Review submissions and follow up on outstanding work. Assign new homework from a class or a student’s page." />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>{Object.entries(FILTERS).map(([k, v]) => <TabsTrigger key={k} value={k}>{v}</TabsTrigger>)}</TabsList>
      </Tabs>
      <Card className="mt-4">
        <CardContent>
          {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : q.data.length ? (
            <ul className="divide-y">
              {q.data.map((h) => {
                const sub = h.submissions[0];
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{h.title}</p>
                      <p className="text-muted-foreground text-xs">
                        <Link href={`/teacher/students/${h.student.id}`} className="hover:underline">{h.student.fullName}</Link> · {h.course.title}
                        {filter === 'SUBMITTED' && sub ? ` · submitted ${formatDateTime(sub.submittedAt, tz)}` : h.dueAt ? ` · due ${formatDateTime(h.dueAt, tz)}` : ''}
                        {filter === 'REVIEWED' && sub?.grade != null ? ` · ${sub.grade}/100` : ''}
                      </p>
                    </div>
                    {filter === 'OVERDUE' ? <Badge variant="destructive">overdue</Badge> : null}
                    {filter === 'SUBMITTED' || filter === 'REVIEWED' ? (
                      <Button size="sm" variant={filter === 'SUBMITTED' ? 'default' : 'outline'} onClick={() => setReviewing(h)}>{filter === 'SUBMITTED' ? 'Review' : 'View'}</Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState icon={ClipboardCheck} title={filter === 'SUBMITTED' ? 'Nothing waiting for review' : 'Nothing here'} />}
        </CardContent>
      </Card>
      {reviewing ? <ReviewHomeworkDialog homework={reviewing} onClose={() => setReviewing(null)} /> : null}
    </>
  );
}
