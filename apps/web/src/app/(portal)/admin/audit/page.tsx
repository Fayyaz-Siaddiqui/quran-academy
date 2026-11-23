'use client';

import type { Paginated } from '@qa/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { History, Search } from 'lucide-react';
import { Fragment, useState } from 'react';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form-controls';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';

type Entry = {
  id: string; action: string; entity: string; entityId: string | null; metadata: unknown; ipAddress: string | null; createdAt: string;
  actor: { id: string; fullName: string; email: string | null } | null;
};
const ENTITIES = ['User', 'Role', 'ClassSession', 'Enrollment', 'Course', 'CmsPage', 'SiteSetting', 'BlogPost', 'TrialBooking', 'Announcement', 'Branch', 'Academy'];

export default function AuditPage() {
  const tz = useAuthStore((s) => s.user?.timezone);
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: '50', ...(entity ? { entity } : {}), ...(search ? { search } : {}) });
  const q = useQuery({ queryKey: ['admin', 'audit', params.toString()], queryFn: () => api<Paginated<Entry>>(`/audit-logs?${params}`), placeholderData: keepPreviousData });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <>
      <PageTitle title="Audit log" description="Every administrative change: who did what, when and from where. Passwords and tokens are redacted." />
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input className="pl-8" placeholder="Filter by action, e.g. user.status" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Filter by action" />
            </div>
            <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Filter by record type">
              <option value="">All record types</option>
              {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
            </Select>
          </div>
          {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} /> : q.data.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs"><tr><th className="py-2 pr-3 font-medium">When</th><th className="py-2 pr-3 font-medium">Who</th><th className="py-2 pr-3 font-medium">Action</th><th className="py-2 pr-3 font-medium">Record</th><th className="py-2 font-medium">IP</th></tr></thead>
                <tbody className="divide-y">
                  {q.data.items.map((e) => (
                    <Fragment key={e.id}>
                      <tr className="hover:bg-secondary/40 cursor-pointer" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                        <td className="py-2 pr-3 text-xs whitespace-nowrap">{formatDateTime(e.createdAt, tz)}</td>
                        <td className="py-2 pr-3">{e.actor ? e.actor.fullName : <span className="text-muted-foreground">system</span>}</td>
                        <td className="py-2 pr-3"><Badge variant="secondary" className="font-mono">{e.action}</Badge></td>
                        <td className="text-muted-foreground py-2 pr-3 text-xs">{e.entity}{e.entityId ? ` · ${e.entityId.slice(0, 10)}…` : ''}</td>
                        <td className="text-muted-foreground py-2 text-xs">{e.ipAddress ?? '—'}</td>
                      </tr>
                      {open === e.id ? (
                        <tr><td colSpan={5} className="bg-muted/40 p-3"><pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap">{JSON.stringify({ entityId: e.entityId, actor: e.actor?.email, ...((e.metadata as object) ?? {}) }, null, 2)}</pre></td></tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={History} title="No matching entries" />}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{q.data?.total ?? 0} entries</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="tabular-nums">{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
