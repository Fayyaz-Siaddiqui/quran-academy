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

export default function StudentClassesPage() {
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const q = useQuery({
    queryKey: ['classes', scope],
    queryFn: () => api<ClassSessionSummary[]>(`/classes?scope=${scope}&limit=100`),
    refetchInterval: scope === 'upcoming' ? 60_000 : false,
  });

  return (
    <>
      <PageTitle title="My classes" description={`All times are shown in your time zone (${tz.replace(/_/g, ' ')}).`} />
      <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
        <TabsList><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="past">Past</TabsTrigger></TabsList>
      </Tabs>
      <Card className="mt-4">
        <CardContent>
          {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : q.data.length ? (
            <ul className="divide-y">{q.data.map((c) => <ClassRow key={c.id} cls={c} timezone={tz} href={`/student/classes/${c.id}`} />)}</ul>
          ) : (
            <EmptyState icon={CalendarDays} title={scope === 'upcoming' ? 'No upcoming classes' : 'No past classes yet'} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
