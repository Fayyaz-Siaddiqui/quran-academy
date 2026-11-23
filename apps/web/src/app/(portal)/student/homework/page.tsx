'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/form-controls';
import { Badge, EmptyState, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api, ApiError, uploadToPresignedUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';

type Homework = {
  id: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  status: 'ASSIGNED' | 'SUBMITTED' | 'REVIEWED' | 'OVERDUE';
  course: { id: string; title: string };
  teacher: { id: string; fullName: string };
  submissions: { id: string; content: string | null; submittedAt: string; grade: number | null; feedback: string | null; reviewedAt: string | null }[];
};

const VARIANT = { ASSIGNED: 'secondary', SUBMITTED: 'success', REVIEWED: 'gold', OVERDUE: 'destructive' } as const;

export default function HomeworkPage() {
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const [active, setActive] = useState<Homework | null>(null);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const q = useQuery({ queryKey: ['homework'], queryFn: () => api<Homework[]>('/students/me/homework') });

  const submit = useMutation({
    mutationFn: async () => {
      let documentId: string | undefined;
      if (file) {
        // Audio recitations or worksheets go straight to private storage.
        const { url, key } = await api<{ url: string; key: string }>('/documents/upload-url', {
          method: 'POST',
          body: { type: 'HOMEWORK_ATTACHMENT', fileName: file.name, mimeType: file.type, sizeBytes: file.size },
        });
        await uploadToPresignedUrl(url, file);
        documentId = (await api<{ id: string }>('/documents/confirm', { method: 'POST', body: { key } })).id;
      }
      return api(`/homework/${active!.id}/submit`, { method: 'POST', body: { content: content || undefined, documentId } });
    },
    onSuccess: () => {
      toast.success('Homework submitted');
      setActive(null);
      setContent('');
      setFile(null);
      void qc.invalidateQueries({ queryKey: ['homework'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Submission failed'),
  });

  const items = (q.data ?? []).filter((h) => (filter === 'open' ? h.status === 'ASSIGNED' || h.status === 'OVERDUE' : h.status === 'SUBMITTED' || h.status === 'REVIEWED'));

  return (
    <>
      <PageTitle title="Homework" description="Complete and submit work set by your teacher." />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList><TabsTrigger value="open">To do</TabsTrigger><TabsTrigger value="done">Submitted</TabsTrigger></TabsList>
      </Tabs>
      <div className="mt-4 grid gap-4">
        {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : items.length ? items.map((h) => {
          const last = h.submissions[0];
          return (
            <Card key={h.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">{h.title}<Badge variant={VARIANT[h.status]}>{h.status.toLowerCase()}</Badge></CardTitle>
                <CardDescription>{h.course.title} · {h.teacher.fullName}{h.dueAt ? ` · due ${formatDateTime(h.dueAt, tz)}` : ''}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm whitespace-pre-line">{h.instructions}</p>
                {last?.reviewedAt ? (
                  <div className="bg-accent/60 rounded-lg p-4 text-sm">
                    <p className="font-semibold">Teacher feedback · {last.grade}/100</p>
                    <p className="mt-1 whitespace-pre-line">{last.feedback}</p>
                  </div>
                ) : last ? <p className="text-muted-foreground text-sm">Submitted {formatDateTime(last.submittedAt, tz)} — awaiting review.</p> : null}
                {h.status !== 'REVIEWED' ? (
                  <Button size="sm" variant={last ? 'outline' : 'default'} onClick={() => setActive(h)}>{last ? 'Resubmit' : 'Submit homework'}</Button>
                ) : null}
              </CardContent>
            </Card>
          );
        }) : <EmptyState icon={ClipboardList} title={filter === 'open' ? 'No homework to do' : 'Nothing submitted yet'} />}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit: {active?.title}</DialogTitle>
            <DialogDescription>Write your answer and/or attach a file (e.g. a PDF or a photo of your work).</DialogDescription>
          </DialogHeader>
          <Field label="Your answer" htmlFor="hw-content">
            <Textarea id="hw-content" rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
          <label className="hover:bg-secondary flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm">
            <Paperclip className="size-4" />
            <span className="truncate">{file ? file.name : 'Attach a file (PDF, JPG, PNG — max 10 MB)'}</span>
            <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending || (!content.trim() && !file)}>
              {submit.isPending ? <Loader2 className="animate-spin" /> : null} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
