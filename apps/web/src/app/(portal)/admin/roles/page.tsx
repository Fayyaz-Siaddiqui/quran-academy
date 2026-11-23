'use client';

import { PERMISSIONS } from '@qa/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Field, Input } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

type Permission = { id: string; key: string; module: string; description: string };
type Role = { id: string; slug: string; name: string; description: string | null; isSystem: boolean; permissions: string[]; userCount: number };

const err = (e: unknown) => (e instanceof ApiError ? e.message : 'Request failed');

function PermissionMatrix({ all, value, onChange, disabled, holdable }: {
  all: Permission[]; value: Set<string>; onChange: (v: Set<string>) => void; disabled?: boolean; holdable: (k: string) => boolean;
}) {
  const groups = useMemo(() => Object.entries(all.reduce<Record<string, Permission[]>>((a, p) => ((a[p.module] ??= []).push(p), a), {})), [all]);
  const toggle = (k: string, on: boolean) => { const n = new Set(value); if (on) n.add(k); else n.delete(k); onChange(n); };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map(([module, perms]) => (
        <fieldset key={module} className="rounded-lg border p-3">
          <legend className="px-1 text-xs font-semibold tracking-wide uppercase">{module}</legend>
          <ul className="space-y-1.5">
            {perms.map((p) => {
              const locked = disabled || !holdable(p.key);
              return (
                <li key={p.key}>
                  <label className={cn('flex items-start gap-2 text-sm', locked && 'opacity-60')} title={!holdable(p.key) ? 'You can only grant permissions you hold' : undefined}>
                    <Checkbox className="mt-0.5" checked={value.has(p.key)} disabled={locked} onChange={(e) => toggle(p.key, e.target.checked)} />
                    <span>{p.description} <code className="text-muted-foreground text-[10px]">{p.key}</code></span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

export default function RolesPage() {
  const me = useAuthStore((s) => s.user);
  const isSuper = !!me?.roles.includes('super-admin');
  const canManage = can(me, PERMISSIONS.ROLES_MANAGE);
  const holdable = (k: string) => isSuper || !!me?.permissions.includes(k as never);
  const qc = useQueryClient();

  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => api<Role[]>('/roles') });
  const perms = useQuery({ queryKey: ['admin', 'permissions'], queryFn: () => api<Permission[]>('/roles/permissions') });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', slug: '', description: '' });

  const selected = roles.data?.find((r) => r.id === (selectedId ?? roles.data?.[0]?.id));
  const current = draft ?? new Set(selected?.permissions ?? []);
  const editable = canManage && !!selected && selected.slug !== 'super-admin' && (!selected.isSystem || isSuper);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'roles'] });

  const save = useMutation({
    mutationFn: () => api(`/roles/${selected!.id}`, { method: 'PATCH', body: { permissions: [...current] } }),
    onSuccess: () => { toast.success('Permissions saved — changes apply within a minute'); setDraft(null); invalidate(); },
    onError: (e) => toast.error(err(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Role deleted'); setSelectedId(null); invalidate(); },
    onError: (e) => toast.error(err(e)),
  });
  const create = useMutation({
    mutationFn: () => api<Role>('/roles', { method: 'POST', body: { ...newRole, description: newRole.description || undefined, permissions: [] } }),
    onSuccess: (r) => { toast.success('Role created'); setCreating(false); setNewRole({ name: '', slug: '', description: '' }); setSelectedId(r.id); invalidate(); },
    onError: (e) => toast.error(err(e)),
  });

  if (roles.isPending || perms.isPending) return <LoadingBlock />;
  if (roles.isError) return <ErrorBlock error={roles.error} />;
  if (perms.isError) return <ErrorBlock error={perms.error} />;

  return (
    <>
      <PageTitle title="Roles & permissions" description="Every API action is checked against these permissions on the server." actions={canManage ? <Button onClick={() => setCreating(true)}><Plus /> New role</Button> : null} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit py-2">
          <ul>
            {roles.data.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => { setSelectedId(r.id); setDraft(null); }}
                  className={cn('hover:bg-secondary flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm', selected?.id === r.id && 'bg-secondary font-medium')}>
                  <span className="flex items-center gap-1.5">{r.isSystem ? <Lock className="text-muted-foreground size-3.5" aria-label="System role" /> : null}{r.name}</span>
                  <span className="text-muted-foreground text-xs">{r.userCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">{selected.name} {selected.isSystem ? <Badge variant="outline">system</Badge> : null}</CardTitle>
              <CardDescription>
                {selected.slug === 'super-admin' ? 'Super Admin always holds every permission.' : selected.isSystem && !isSuper ? 'System roles can only be changed by a Super Admin.' : `${selected.userCount} user(s) hold this role.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PermissionMatrix all={perms.data} value={current} onChange={setDraft} disabled={!editable} holdable={holdable} />
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => save.mutate()} disabled={!draft || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null} Save permissions</Button>
                  {draft ? <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button> : null}
                  {!selected.isSystem ? (
                    <Button variant="ghost" className="text-destructive ml-auto" disabled={selected.userCount > 0 || remove.isPending}
                      title={selected.userCount ? 'Reassign its users before deleting' : undefined}
                      onClick={() => confirm(`Delete the role "${selected.name}"?`) && remove.mutate(selected.id)}>
                      <Trash2 /> Delete role
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New role</DialogTitle></DialogHeader>
          <Field label="Name" htmlFor="r-name"><Input id="r-name" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value, slug: e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
          <Field label="Identifier" htmlFor="r-slug" hint="Lowercase letters, numbers and dashes"><Input id="r-slug" value={newRole.slug} onChange={(e) => setNewRole({ ...newRole, slug: e.target.value })} /></Field>
          <Field label="Description" htmlFor="r-desc"><Input id="r-desc" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} /></Field>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending || newRole.name.length < 2 || newRole.slug.length < 2}>Create role</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
