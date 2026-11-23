'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, Layers, Star, TrendingUp } from 'lucide-react';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState, Progress } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/utils';

type ProgressData = {
  summary: { memorizedSurahs: number[]; memorizedAyahs: number; totalAyahs: number; lastQaidaLesson: number | null };
  entries: { id: string; type: string; surah: number; ayahFrom: number; ayahTo: number; qaidaLesson: number | null; rating: number | null; notes: string | null; recordedAt: string; teacher: { fullName: string } }[];
};

const TYPE_LABEL: Record<string, string> = { QAIDA: 'Noorani Qaida', READING: 'Reading', MEMORIZATION: 'Memorization', REVISION: 'Revision', TAJWEED: 'Tajweed' };

export function ProgressView({ studentId }: { studentId: string }) {
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const q = useQuery({ queryKey: ['progress', studentId], queryFn: () => api<ProgressData>(`/students/${studentId}/progress`) });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const { summary, entries } = q.data;
  const pct = Math.round((summary.memorizedAyahs / summary.totalAyahs) * 1000) / 10;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="py-4"><CardContent className="flex items-center gap-3"><BookOpenCheck className="text-primary size-6" /><div><p className="text-2xl font-bold">{summary.memorizedSurahs.length}</p><p className="text-muted-foreground text-xs">Surahs fully memorised</p></div></CardContent></Card>
        <Card className="py-4"><CardContent className="flex items-center gap-3"><TrendingUp className="text-primary size-6" /><div><p className="text-2xl font-bold">{summary.memorizedAyahs.toLocaleString()}</p><p className="text-muted-foreground text-xs">Ayahs memorised ({pct}% of the Quran)</p></div></CardContent></Card>
        <Card className="py-4"><CardContent className="flex items-center gap-3"><Layers className="text-primary size-6" /><div><p className="text-2xl font-bold">{summary.lastQaidaLesson ?? '—'}</p><p className="text-muted-foreground text-xs">Latest Qaida lesson</p></div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Hifz journey</CardTitle></CardHeader>
        <CardContent>
          <Progress value={pct} aria-label="Quran memorised" />
          {summary.memorizedSurahs.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">{summary.memorizedSurahs.sort((a, b) => b - a).map((s) => <Badge key={s} variant="gold">Surah {s}</Badge>)}</div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Lesson log</CardTitle></CardHeader>
        <CardContent>
          {entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left text-xs"><tr><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Type</th><th className="py-2 pr-4 font-medium">Portion</th><th className="py-2 pr-4 font-medium">Rating</th><th className="py-2 font-medium">Teacher notes</th></tr></thead>
                <tbody className="divide-y">
                  {entries.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="py-2.5 pr-4 whitespace-nowrap">{formatDate(e.recordedAt, tz)}</td>
                      <td className="py-2.5 pr-4"><Badge variant="secondary">{TYPE_LABEL[e.type] ?? e.type}</Badge></td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{e.type === 'QAIDA' ? `Lesson ${e.qaidaLesson}` : `Surah ${e.surah}: ${e.ayahFrom}–${e.ayahTo}`}</td>
                      <td className="py-2.5 pr-4">{e.rating ? <span className="text-gold inline-flex" aria-label={`${e.rating} of 5`}>{Array.from({ length: e.rating }, (_, i) => <Star key={i} className="fill-gold size-3.5" />)}</span> : '—'}</td>
                      <td className="text-muted-foreground py-2.5">{e.notes ?? '—'}<span className="block text-xs">{e.teacher.fullName}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={TrendingUp} title="No progress recorded yet" description="Your teacher records what you read and memorise after each class." />}
        </CardContent>
      </Card>
    </div>
  );
}
