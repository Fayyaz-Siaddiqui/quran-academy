'use client';

import { SYSTEM_ROLE_LABELS } from '@qa/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Megaphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form-controls';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';

type Announcement = { id: string; title: string; body: string; audience: string[]; publishedAt: string; expiresAt: string | null };
const AUDIENCES = ['student', 'parent', 'teacher', 'academy-admin', 'branch-manager', 'accountant', 'support-staff'] as const;

function state(a: Announcement) {
  const now = Date.now();
  if (new Date(a.publishedAt).getTime() > now) return { label: 'scheduled', variant: 'warning' as const };
  if (a.expiresAt && new Date(a.expiresAt).getTime() < now) return { label: 'expired', variant: 'outline' as const };
  return { label: 'live', variant: 'success' as const };
}

export default function AnnouncementsPage() {
  const tz = useAuthStore((s) => s.user?.timezone);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'announcements'], queryFn: () => api<Announcement[]>('/announcements') });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<string[]>([]);
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const create = useMutation({
    mutationFn: () => api('/announcements', {
      method: 'POST',
      body: {
        title: title.trim(), body: body.trim(), audience,
        publishedAt: publishAt ? new Date(publishAt).toISOString() : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      },
    }),
    onSuccess: () => {
      toast.success(publishAt && new Date(publishAt) > new Date() ? 'Announcement scheduled' : 'Announcement published');
      setTitle(''); setBody(''); setAudience([]); setPublishAt(''); setExpiresAt('');
      void qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not publish'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Announcement removed'); void qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }); },
  });
  const expiryInvalid = !!expiresAt && new Date(expiresAt) <= new Date(publishAt || Date.now());

  return (
    <>
      <PageTitle title="Announcements" description="Shown on dashboards and pushed live to people who are signed in." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="h-fit">
          <CardHeader><CardTitle>New announcement</CardTitle><CardDescription>Leave the audience empty to address everyone.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <Field label="Title" htmlFor="an-title"><Input id="an-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field label="Message" htmlFor="an-body"><Textarea id="an-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
              <fieldset>
                <legend className="text-sm font-medium">Audience</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {AUDIENCES.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={audience.includes(r)} onChange={(e) => setAudience((a) => (e.target.checked ? [...a, r] : a.filter((x) => x !== r)))} />
                      {SYSTEM_ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Publish at (optional)" htmlFor="an-pub" hint="Empty = now"><Input id="an-pub" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} /></Field>
                <Field label="Expires (optional)" htmlFor="an-exp" error={expiryInvalid ? 'Must be after publishing' : undefined}><Input id="an-exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field>
              </div>
              <Button type="submit" disabled={create.isPending || title.trim().length < 2 || body.trim().length < 2 || expiryInvalid} className="justify-self-start">
                {create.isPending ? <Loader2 className="animate-spin" /> : <Megaphone />} {publishAt && new Date(publishAt) > new Date() ? 'Schedule' : 'Publish now'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} /> : q.data.length ? q.data.map((a) => {
            const s = state(a);
            return (
              <Card key={a.id}>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.title} <Badge variant={s.variant} className="ml-1 align-middle">{s.label}</Badge></p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(a.publishedAt, tz)}{a.expiresAt ? ` → ${formatDateTime(a.expiresAt, tz)}` : ''} · {a.audience.length ? a.audience.map((r) => SYSTEM_ROLE_LABELS[r as keyof typeof SYSTEM_ROLE_LABELS] ?? r).join(', ') : 'Everyone'}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" aria-label="Delete announcement" onClick={() => confirm('Remove this announcement?') && remove.mutate(a.id)}><Trash2 /></Button>
                  </div>
                  <p className="text-sm whitespace-pre-line">{a.body}</p>
                </CardContent>
              </Card>
            );
          }) : <EmptyState icon={Megaphone} title="No announcements yet" />}
        </div>
      </div>
    </>
  );
}
