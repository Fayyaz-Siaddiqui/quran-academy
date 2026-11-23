'use client';

import { PERMISSIONS } from '@qa/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { TimezoneSelect } from '@/components/forms/pickers';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Field, Input } from '@/components/ui/form-controls';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';

type Branch = { id: string; name: string; code: string; timezone: string; isActive: boolean };

function BranchDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(branch?.name ?? '');
  const [code, setCode] = useState(branch?.code ?? '');
  const [timezone, setTimezone] = useState(branch?.timezone ?? 'UTC');
  const [isActive, setIsActive] = useState(branch?.isActive ?? true);
  const m = useMutation({
    mutationFn: () => branch
      ? api(`/branches/${branch.id}`, { method: 'PATCH', body: { name: name.trim(), timezone, isActive } })
      : api('/branches', { method: 'POST', body: { name: name.trim(), code, timezone } }),
    onSuccess: () => { toast.success(branch ? 'Branch updated' : 'Branch created'); void qc.invalidateQueries({ queryKey: ['admin', 'branches'] }); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save branch'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{branch ? `Edit ${branch.name}` : 'New branch'}</DialogTitle>
          <DialogDescription>Branch managers only see users and classes in their own branch.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="br-name"><Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Code" htmlFor="br-code" hint={branch ? 'Codes cannot be changed' : 'Capital letters, numbers and dashes, e.g. UK-01'}>
            <Input id="br-code" value={code} disabled={!!branch} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
          </Field>
          <Field label="Time zone" htmlFor="br-tz"><TimezoneSelect id="br-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Field>
          {branch ? <label className="flex items-center gap-2 text-sm"><Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || name.trim().length < 2 || !/^[A-Z0-9-]{2,20}$/.test(code)}>{m.isPending ? <Loader2 className="animate-spin" /> : null} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BranchesPage() {
  const manage = can(useAuthStore((s) => s.user), PERMISSIONS.BRANCHES_MANAGE);
  const q = useQuery({ queryKey: ['admin', 'branches'], queryFn: () => api<Branch[]>('/branches') });
  const [editing, setEditing] = useState<Branch | null | 'new'>(null);
  return (
    <>
      <PageTitle title="Branches" description="Optional: split the academy into branches (e.g. by region) with their own managers." actions={manage ? <Button onClick={() => setEditing('new')}><Plus /> New branch</Button> : null} />
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} /> : q.data.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-start gap-3">
                <Building2 className="text-primary mt-0.5 size-5" aria-hidden />
                <div className="flex-1">
                  <p className="font-semibold">{b.name} {!b.isActive ? <Badge variant="outline" className="ml-1">inactive</Badge> : null}</p>
                  <p className="text-muted-foreground text-xs">{b.code} · {b.timezone.replace(/_/g, ' ')}</p>
                </div>
                {manage ? <Button size="icon" variant="ghost" aria-label={`Edit ${b.name}`} onClick={() => setEditing(b)}><Pencil /></Button> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={Building2} title="No branches" />}
      {editing ? <BranchDialog branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
