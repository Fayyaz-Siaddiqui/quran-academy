'use client';

import { PERMISSIONS, type Paginated } from '@qa/shared-types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Loader2, Mail, MessageCircle, Phone } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Select, Textarea } from '@/components/ui/form-controls';
import { Badge, EmptyState, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { COUNTRIES } from '@/lib/countries';
import { cn, formatDateTime } from '@/lib/utils';

const STATUSES = ['NEW', 'CONTACTED', 'SCHEDULED', 'CONVERTED', 'CLOSED'] as const;
type LeadStatus = (typeof STATUSES)[number];
const VARIANT: Record<LeadStatus, 'warning' | 'secondary' | 'default' | 'success' | 'outline'> = { NEW: 'warning', CONTACTED: 'secondary', SCHEDULED: 'default', CONVERTED: 'success', CLOSED: 'outline' };

type Trial = {
  id: string; fullName: string; email: string; phone: string; country: string; timezone: string; courseSlug: string; studentAge: number | null;
  numberOfStudents: number; preferredDate: string; preferredTime: string; message: string | null; status: LeadStatus; internalNotes: string | null; createdAt: string;
};
type Message = { id: string; fullName: string; email: string; phone: string | null; subject: string; message: string; status: LeadStatus; createdAt: string };

const country = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
const wa = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

function TrialDetail({ t, onSaved }: { t: Trial; onSaved: () => void }) {
  const tz = useAuthStore((s) => s.user?.timezone);
  const manage = can(useAuthStore((s) => s.user), PERMISSIONS.LEADS_MANAGE);
  const [status, setStatus] = useState<LeadStatus>(t.status);
  const [notes, setNotes] = useState(t.internalNotes ?? '');
  useEffect(() => { setStatus(t.status); setNotes(t.internalNotes ?? ''); }, [t]);
  const m = useMutation({
    mutationFn: () => api(`/leads/trial-bookings/${t.id}`, { method: 'PATCH', body: { status, internalNotes: notes } }),
    onSuccess: () => { toast.success('Lead updated'); onSaved(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update'),
  });
  const greeting = `Assalamu alaikum ${t.fullName.split(' ')[0]}, thank you for booking a free ${t.courseSlug.replace(/-/g, ' ')} trial.`;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t.fullName}</h2>
        <p className="text-muted-foreground text-sm">Requested {formatDateTime(t.createdAt, tz)}</p>
      </div>
      <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Course</dt><dd className="capitalize">{t.courseSlug.replace(/-/g, ' ')}</dd>
        <dt className="text-muted-foreground">Preferred slot</dt><dd>{t.preferredDate} at {t.preferredTime} <span className="text-muted-foreground">({t.timezone.replace(/_/g, ' ')})</span></dd>
        <dt className="text-muted-foreground">Students</dt><dd>{t.numberOfStudents}{t.studentAge ? ` · age ${t.studentAge}` : ''}</dd>
        <dt className="text-muted-foreground">Country</dt><dd>{country(t.country)}</dd>
        <dt className="text-muted-foreground">Email</dt><dd className="break-all">{t.email}</dd>
        <dt className="text-muted-foreground">Phone</dt><dd>{t.phone}</dd>
      </dl>
      {t.message ? <p className="bg-muted rounded-md p-3 text-sm whitespace-pre-line">{t.message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild><a href={wa(t.phone, greeting)} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></Button>
        <Button size="sm" variant="outline" asChild><a href={`mailto:${t.email}?subject=${encodeURIComponent('Your free trial class')}&body=${encodeURIComponent(greeting)}`}><Mail /> Email</a></Button>
        <Button size="sm" variant="outline" asChild><a href={`tel:${t.phone.replace(/\s/g, '')}`}><Phone /> Call</a></Button>
      </div>
      {manage ? (
        <div className="grid gap-3 border-t pt-4">
          <Field label="Status" htmlFor="ld-status">
            <Select id="ld-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </Select>
          </Field>
          <Field label="Internal notes" htmlFor="ld-notes" hint="Only staff see these"><Textarea id="ld-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button onClick={() => m.mutate()} disabled={m.isPending || (status === t.status && notes === (t.internalNotes ?? ''))} className="justify-self-start">
            {m.isPending ? <Loader2 className="animate-spin" /> : null} Save
          </Button>
          {status === 'CONVERTED' ? <p className="text-muted-foreground text-xs">Next: once they register, enrol them from Enrolments → Waiting.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Leads() {
  const user = useAuthStore((s) => s.user);
  const tz = user?.timezone;
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get('tab') === 'messages' ? 'messages' : 'trials';
  const [status, setStatus] = useState<string>('NEW');
  const [selected, setSelected] = useState<string | null>(null);
  const qs = `?pageSize=50${status ? `&status=${status}` : ''}`;

  const trials = useQuery({ queryKey: ['admin', 'leads', 'trials', status], queryFn: () => api<Paginated<Trial>>(`/leads/trial-bookings${qs}`), enabled: tab === 'trials', placeholderData: keepPreviousData });
  const messages = useQuery({ queryKey: ['admin', 'leads', 'messages', status], queryFn: () => api<Paginated<Message>>(`/leads/contact-messages${qs}`), enabled: tab === 'messages', placeholderData: keepPreviousData });
  const setMsgStatus = useMutation({
    mutationFn: ({ id, s }: { id: string; s: LeadStatus }) => api(`/leads/contact-messages/${id}`, { method: 'PATCH', body: { status: s } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] });
  const current = trials.data?.items.find((t) => t.id === selected) ?? trials.data?.items[0];

  return (
    <>
      <PageTitle title="Leads inbox" description="Free-trial requests and contact-form messages from the website." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => { setSelected(null); router.replace(`${pathname}${v === 'messages' ? '?tab=messages' : ''}`); }}>
          <TabsList><TabsTrigger value="trials">Free-trial requests</TabsTrigger><TabsTrigger value="messages">Contact messages</TabsTrigger></TabsList>
        </Tabs>
        <Select className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setSelected(null); }} aria-label="Status filter">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </Select>
      </div>

      {tab === 'trials' ? (
        trials.isPending ? <LoadingBlock /> : trials.isError ? <ErrorBlock error={trials.error} /> : trials.data.items.length ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card className="py-0">
              <CardContent className="divide-y px-0">
                {trials.data.items.map((t) => (
                  <button key={t.id} type="button" onClick={() => setSelected(t.id)}
                    className={cn('hover:bg-secondary/50 flex w-full items-start gap-3 px-4 py-3 text-left', current?.id === t.id && 'bg-secondary')}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.fullName}</p>
                      <p className="text-muted-foreground truncate text-xs capitalize">{t.courseSlug.replace(/-/g, ' ')} · {country(t.country)} · {formatDateTime(t.createdAt, tz)}</p>
                    </div>
                    <Badge variant={VARIANT[t.status]}>{t.status.toLowerCase()}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
            {current ? <Card><CardContent><TrialDetail t={current} onSaved={refresh} /></CardContent></Card> : null}
          </div>
        ) : <EmptyState icon={Inbox} title="No trial requests here" />
      ) : messages.isPending ? <LoadingBlock /> : messages.isError ? <ErrorBlock error={messages.error} /> : messages.data.items.length ? (
        <div className="grid gap-4">
          {messages.data.items.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{m.subject}</p>
                    <p className="text-muted-foreground text-xs">{m.fullName} · {m.email}{m.phone ? ` · ${m.phone}` : ''} · {formatDateTime(m.createdAt, tz)}</p>
                  </div>
                  {can(user, PERMISSIONS.LEADS_MANAGE) ? (
                    <Select className="h-8 w-36 text-xs" value={m.status} aria-label="Message status" onChange={(e) => setMsgStatus.mutate({ id: m.id, s: e.target.value as LeadStatus })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                    </Select>
                  ) : <Badge variant={VARIANT[m.status]}>{m.status.toLowerCase()}</Badge>}
                </div>
                <p className="text-sm whitespace-pre-line">{m.message}</p>
                <Button size="sm" variant="outline" asChild><a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}><Mail /> Reply by email</a></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={Mail} title="No messages here" />}
    </>
  );
}

export default function LeadsPage() {
  return <Suspense><Leads /></Suspense>;
}
