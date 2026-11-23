'use client';

import type { TeacherStudent } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/form-controls';
import { Badge, EmptyState, UserAvatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { describePortion } from '@/lib/quran';
import { formatDateTime } from '@/lib/utils';

export default function TeacherStudentsPage() {
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['teacher', 'students'], queryFn: () => api<TeacherStudent[]>('/teachers/me/students') });
  const list = (q.data ?? []).filter((s) => s.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageTitle title="My students" description="Everyone you teach, with their next class, attendance and latest progress." />
      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input className="pl-8" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
      </div>
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <Link key={s.id} href={`/teacher/students/${s.id}`}>
              <Card className="hover:border-primary/40 h-full transition-colors">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={s.fullName} className="size-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.fullName}</p>
                      <p className="text-muted-foreground text-xs">{[s.age !== null ? `${s.age} yrs` : null, s.country, s.timezone.replace(/_/g, ' ')].filter(Boolean).join(' · ')}</p>
                    </div>
                    {s.homeworkAwaitingReview ? <Badge variant="warning">{s.homeworkAwaitingReview} to review</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-1">{s.courses.map((c) => <Badge key={c.enrollmentId} variant="secondary">{c.title}</Badge>)}</div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Next class</dt><dd className="font-medium">{s.nextClass ? formatDateTime(s.nextClass.startsAt, tz) : '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Attendance</dt><dd className="font-medium">{s.attendancePercent !== null ? `${s.attendancePercent}%` : '—'}</dd></div>
                    <div className="col-span-2"><dt className="text-muted-foreground">Latest progress</dt><dd className="font-medium">{s.latestProgress ? describePortion(s.latestProgress) : 'Not recorded yet'}</dd></div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : <EmptyState icon={Users} title={search ? 'No students match' : 'No students yet'} description={search ? undefined : 'Students appear here once the academy enrols them with you or schedules your classes.'} />}
    </>
  );
}
