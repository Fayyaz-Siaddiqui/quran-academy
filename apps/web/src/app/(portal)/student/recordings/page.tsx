'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, PlayCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatDuration } from '@/lib/utils';

type Recording = {
  id: string;
  title: string;
  durationSeconds: number | null;
  recordedAt: string;
  classSession: { id: string; title: string; course: { title: string }; teacher: { fullName: string } };
};

function Player({ id, onClose, title }: { id: string; title?: string; onClose: () => void }) {
  // Signed URLs are short-lived; fetch a fresh one each time the player opens.
  const q = useQuery({ queryKey: ['recording-url', id], queryFn: () => api<{ url: string }>(`/recordings/${id}/url`), staleTime: 5 * 60_000 });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{title ?? 'Class recording'}</DialogTitle></DialogHeader>
        {q.isPending ? <div className="flex aspect-video items-center justify-center"><Loader2 className="animate-spin" /></div> : q.isError ? <ErrorBlock error={q.error} /> : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={q.data.url} controls autoPlay controlsList="nodownload" className="aspect-video w-full rounded-lg bg-black" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecordingsList() {
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const router = useRouter();
  const play = useSearchParams().get('play');
  const q = useQuery({ queryKey: ['recordings'], queryFn: () => api<Recording[]>('/students/me/recordings') });
  const playing = q.data?.find((r) => r.id === play);

  return (
    <>
      <PageTitle title="Class recordings" description="Watch your past classes again to revise what your teacher corrected." />
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : q.data.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((r) => (
            <Card key={r.id} className="hover:border-primary/40 cursor-pointer transition-colors" onClick={() => router.push(`?play=${r.id}`)}>
              <CardContent className="flex gap-4">
                <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-lg"><PlayCircle /></div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.classSession.title}</p>
                  <p className="text-muted-foreground truncate text-sm">{r.classSession.course.title} · {r.classSession.teacher.fullName}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(r.recordedAt, tz)} · {formatDuration(r.durationSeconds)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={PlayCircle} title="No recordings yet" description="Recordings of your classes appear here shortly after each class ends." />}
      {play ? <Player id={play} title={playing?.title} onClose={() => router.push('?')} /> : null}
    </>
  );
}

export default function RecordingsPage() {
  return <Suspense><RecordingsList /></Suspense>;
}
