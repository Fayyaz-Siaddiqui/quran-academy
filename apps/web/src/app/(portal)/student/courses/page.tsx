'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge, EmptyState, Progress } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';

type Lesson = { id: string; title: string; summary: string | null; sortOrder: number; completedAt: string | null };
type MyCourse = {
  enrollmentId: string;
  status: string;
  teacher: { id: string; fullName: string } | null;
  course: { id: string; slug: string; title: string; level: string };
  progressPercent: number;
  lessons: Lesson[];
};

export default function StudentCoursesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-courses'], queryFn: () => api<MyCourse[]>('/me/courses') });
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const lesson = useQuery({
    queryKey: ['lesson', openLesson],
    queryFn: () => api<{ id: string; title: string; content: string | null; summary: string | null }>(`/me/lessons/${openLesson}`),
    enabled: !!openLesson,
  });
  const complete = useMutation({
    mutationFn: (lessonId: string) => api(`/me/lessons/${lessonId}/complete`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Lesson marked as complete');
      void qc.invalidateQueries({ queryKey: ['my-courses'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update lesson'),
  });

  return (
    <>
      <PageTitle title="Courses & lessons" description="Work through your curriculum and mark lessons complete as you go." />
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : q.data.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {q.data.map((e) => (
            <Card key={e.enrollmentId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">{e.course.title}<Badge variant={e.status === 'ACTIVE' ? 'success' : 'secondary'}>{e.status.toLowerCase()}</Badge></CardTitle>
                <CardDescription>{e.course.level}{e.teacher ? ` · ${e.teacher.fullName}` : ''}</CardDescription>
                <div className="mt-2 flex items-center gap-3"><Progress value={e.progressPercent} /><span className="text-sm tabular-nums">{e.progressPercent}%</span></div>
              </CardHeader>
              <CardContent>
                <ol className="divide-y rounded-lg border">
                  {e.lessons.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                      {l.completedAt ? <CheckCircle2 className="text-success size-5 shrink-0" aria-label="Completed" /> : <Circle className="text-muted-foreground size-5 shrink-0" aria-label="Not completed" />}
                      <button type="button" onClick={() => setOpenLesson(l.id)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">
                        {l.sortOrder}. {l.title}
                      </button>
                      {!l.completedAt && e.status === 'ACTIVE' ? (
                        <Button size="sm" variant="ghost" disabled={complete.isPending} onClick={() => complete.mutate(l.id)}>Mark done</Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="You are not enrolled in a course yet" description="Once the academy enrols you and assigns a teacher, your lessons appear here." />
      )}

      <Dialog open={!!openLesson} onOpenChange={(o) => !o && setOpenLesson(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{lesson.data?.title ?? 'Lesson'}</DialogTitle></DialogHeader>
          {lesson.isPending ? <Loader2 className="animate-spin" /> : (
            <div className="prose-content">
              {lesson.data?.content ? <ReactMarkdown>{lesson.data.content}</ReactMarkdown> : <p>{lesson.data?.summary ?? 'Your teacher covers this lesson in class. Notes will appear here when added.'}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
