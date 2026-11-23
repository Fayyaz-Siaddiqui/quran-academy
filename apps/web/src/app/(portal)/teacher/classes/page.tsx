'use client';

import type { ClassSessionSummary } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { ClassRow } from '@/components/portal/class-row';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

/** Groups classes under a day heading in the teacher's zone. */
function byDay(classes: ClassSessionSummary[], tz: string) {
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
  const groups = new Map<string, ClassSessionSummary[]>();
  for (const c of classes) {
    const k = fmt.format(new Date(c.startsAt));
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.entries()];
}

export default function TeacherClassesPage() {
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const q = useQuery({
    queryKey: ['classes', 'teaching', scope],
    queryFn: () => api<ClassSessionSummary[]>(`/classes?scope=${scope}&limit=200`),
    refetchInterval: scope === 'upcoming' ? 60_000 : false,
  });

  return (
    <>
      <PageTitle title="Schedule" description={`Times in ${tz.replace(/_/g, ' ')}. Classes open for joining 10 minutes before they start.`} />
      <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
        <TabsList><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="past">Past</TabsTrigger></TabsList>
      </Tabs>
      <div className="mt-4 space-y-4">
        {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : q.data.length ? (
          byDay(q.data, tz).map(([day, items]) => (
            <Card key={day}>
              <CardContent>
                <h2 className="text-muted-foreground mb-1 text-sm font-semibold">{day}</h2>
                <ul className="divide-y">{items.map((c) => <ClassRow key={c.id} cls={c} timezone={tz} compact href={`/teacher/classes/${c.id}`} />)}</ul>
              </CardContent>
            </Card>
          ))
        ) : <EmptyState icon={CalendarDays} title={scope === 'upcoming' ? 'No upcoming classes' : 'No past classes'} />}
      </div>
    </>
  );
}
