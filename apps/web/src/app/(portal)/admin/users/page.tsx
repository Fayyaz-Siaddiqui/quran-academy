'use client';

import { PERMISSIONS, type Paginated } from '@qa/shared-types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, History, Loader2, MoreHorizontal, PauseCircle, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';

type Role = { id: string; slug: string; name: string };
type UserRow = {
  id: string; email: string | null; fullName: string; phone: string | null; country: string | null; status: string; statusReason: string | null;
  lastLoginAt: string | null; createdAt: string; twoFactorEnabled: boolean; roles: Role[];
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'> = {
  ACTIVE: 'success', PENDING_VERIFICATION: 'secondary', PENDING_APPROVAL: 'warning', INACTIVE: 'outline', SUSPENDED: 'destructive', REJECTED: 'destructive',
};

function StatusDialog({ user, status, onClose }: { user: UserRow; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/users/${user.id}/status`, { method: 'PATCH', body: { status, reason: reason || undefined } }),
    onSuccess: () => { toast.success(`${user.fullName} is now ${status.toLowerCase()}`); void qc.invalidateQueries({ queryKey: ['admin', 'users'] }); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not change status'),
  });
  const verb = status === 'ACTIVE' ? 'Activate' : status === 'INACTIVE' ? 'Deactivate' : 'Suspend';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{verb} {user.fullName}?</DialogTitle>
          <DialogDescription>{status === 'ACTIVE' ? 'They will be able to sign in again.' : 'They will be signed out of all devices immediately and cannot sign in.'} The user is notified by email.</DialogDescription>
        </DialogHeader>
        {status !== 'ACTIVE' ? <Field label="Reason (shared with the user)" htmlFor="st-reason"><Textarea id="st-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={status === 'ACTIVE' ? 'default' : 'destructive'} onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? <Loader2 className="animate-spin" /> : null} {verb}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => api<(Role & { isSystem: boolean })[]>('/roles') });
  const [selected, setSelected] = useState(new Set(user.roles.map((r) => r.id)));
  const m = useMutation({
    mutationFn: () => api(`/users/${user.id}/roles`, { method: 'PATCH', body: { roleIds: [...selected] } }),
    onSuccess: () => { toast.success('Roles updated'); void qc.invalidateQueries({ queryKey: ['admin', 'users'] }); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update roles'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Roles for {user.fullName}</DialogTitle><DialogDescription>You can only grant roles whose permissions you hold yourself.</DialogDescription></DialogHeader>
        {roles.isPending ? <Loader2 className="animate-spin" /> : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {roles.data?.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.has(r.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                  {r.name} {r.isSystem ? <Badge variant="outline">system</Badge> : null}
                </label>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending || selected.size === 0}>Save roles</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivityDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const tz = useAuthStore((s) => s.user?.timezone);
  const logins = useQuery({ queryKey: ['admin', 'logins', user.id], queryFn: () => api<{ id: string; success: boolean; reason: string | null; ipAddress: string | null; createdAt: string }[]>(`/users/${user.id}/login-activity`) });
  const audit = useQuery({ queryKey: ['admin', 'audit', user.id], queryFn: () => api<{ id: string; action: string; createdAt: string; actorId: string | null }[]>(`/users/${user.id}/activity`) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Activity — {user.fullName}</DialogTitle></DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Sign-ins</h3>
            <ul className="space-y-1.5 text-xs">
              {logins.data?.slice(0, 30).map((l) => (
                <li key={l.id} className="flex flex-wrap gap-1.5"><Badge variant={l.success ? 'success' : 'destructive'}>{l.success ? 'ok' : (l.reason ?? 'failed').replace(/_/g, ' ')}</Badge>{formatDateTime(l.createdAt, tz)}<span className="text-muted-foreground">{l.ipAddress}</span></li>
              )) ?? <Loader2 className="animate-spin" />}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Account changes</h3>
            <ul className="space-y-1.5 text-xs">
              {audit.data?.length ? audit.data.slice(0, 30).map((a) => (
                <li key={a.id}><span className="font-medium">{a.action}</span> · {formatDateTime(a.createdAt, tz)}{a.actorId === user.id ? ' (self)' : ''}</li>
              )) : <li className="text-muted-foreground">No changes recorded</li>}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsersPage() {
  const me = useAuthStore((s) => s.user);
  const tz = me?.timezone;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ kind: 'status'; user: UserRow; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' } | { kind: 'roles' | 'activity'; user: UserRow } | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: '20', ...(search ? { search } : {}), ...(status ? { status } : {}), ...(role ? { role } : {}) });
  const q = useQuery({ queryKey: ['admin', 'users', params.toString()], queryFn: () => api<Paginated<UserRow>>(`/users?${params}`), placeholderData: keepPreviousData });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <>
      <PageTitle title="Users" description="Search accounts, change status, assign roles and review activity." />
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input placeholder="Search name, email or phone" className="pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search users" />
            </div>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="">All statuses</option>
              {Object.keys(STATUS_VARIANT).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
            </Select>
            <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
              <option value="">All roles</option>
              {['student', 'parent', 'teacher', 'academy-admin', 'branch-manager', 'accountant', 'support-staff', 'super-admin'].map((r) => <option key={r} value={r}>{r.replace(/-/g, ' ')}</option>)}
            </Select>
          </div>

          {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs">
                  <tr><th className="py-2 pr-4 font-medium">User</th><th className="py-2 pr-4 font-medium">Roles</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 font-medium">Last login</th><th className="py-2" /></tr>
                </thead>
                <tbody className="divide-y">
                  {q.data.items.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{u.fullName} {u.twoFactorEnabled ? <ShieldCheck className="text-success inline size-3.5" aria-label="2FA on" /> : null}</p>
                        <p className="text-muted-foreground text-xs">{u.email ?? 'no login (managed by parent)'}{u.country ? ` · ${u.country}` : ''}</p>
                      </td>
                      <td className="py-3 pr-4"><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.id} variant="secondary">{r.name}</Badge>)}</div></td>
                      <td className="py-3 pr-4">
                        <Badge variant={STATUS_VARIANT[u.status] ?? 'outline'}>{u.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                        {u.statusReason ? <p className="text-muted-foreground mt-1 max-w-48 truncate text-xs" title={u.statusReason}>{u.statusReason}</p> : null}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 text-xs whitespace-nowrap">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, tz) : 'Never'}</td>
                      <td className="py-3 text-right">
                        {u.id !== me?.id ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${u.fullName}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {can(me, PERMISSIONS.USERS_SUSPEND) ? (
                                <>
                                  {u.status !== 'ACTIVE' ? <DropdownMenuItem onSelect={() => setAction({ kind: 'status', user: u, status: 'ACTIVE' })}><CheckCircle2 /> Activate</DropdownMenuItem> : null}
                                  {u.status === 'ACTIVE' ? <DropdownMenuItem onSelect={() => setAction({ kind: 'status', user: u, status: 'INACTIVE' })}><PauseCircle /> Deactivate</DropdownMenuItem> : null}
                                  {u.status !== 'SUSPENDED' ? <DropdownMenuItem className="text-destructive" onSelect={() => setAction({ kind: 'status', user: u, status: 'SUSPENDED' })}><Ban /> Suspend</DropdownMenuItem> : null}
                                  <DropdownMenuSeparator />
                                </>
                              ) : null}
                              {can(me, PERMISSIONS.ROLES_MANAGE) ? <DropdownMenuItem onSelect={() => setAction({ kind: 'roles', user: u })}><ShieldCheck /> Edit roles</DropdownMenuItem> : null}
                              {can(me, PERMISSIONS.USERS_ACTIVITY) ? <DropdownMenuItem onSelect={() => setAction({ kind: 'activity', user: u })}><History /> View activity</DropdownMenuItem> : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : <Badge variant="outline">You</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!q.data.items.length ? <p className="text-muted-foreground py-8 text-center text-sm">No users match these filters.</p> : null}
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{q.data?.total ?? 0} users</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="tabular-nums">{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {action?.kind === 'status' ? <StatusDialog user={action.user} status={action.status} onClose={() => setAction(null)} /> : null}
      {action?.kind === 'roles' ? <RolesDialog user={action.user} onClose={() => setAction(null)} /> : null}
      {action?.kind === 'activity' ? <ActivityDialog user={action.user} onClose={() => setAction(null)} /> : null}
    </>
  );
}
