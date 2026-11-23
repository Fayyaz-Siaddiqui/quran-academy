'use client';

import type { StudentDashboard } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { StudentDashboardView } from '@/components/portal/student-dashboard-view';
import { api } from '@/lib/api';

export default function StudentDashboardPage() {
  const q = useQuery({
    queryKey: ['dashboard', 'student'],
    queryFn: () => api<StudentDashboard>('/students/me/dashboard'),
    refetchInterval: 60_000, // keeps "Join" buttons accurate as class windows open
  });
  if (q.isPending) return <LoadingBlock rows={5} />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  return <StudentDashboardView data={q.data} />;
}
