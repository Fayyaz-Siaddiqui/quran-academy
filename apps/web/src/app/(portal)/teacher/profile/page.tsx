'use client';

import { LANGUAGES } from '@qa/shared-validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type Slot = { dayOfWeek: number; startTime: string; endTime: string };
type TeacherProfile = {
  bio: string | null; qualifications: string; experienceYears: number; certifications: string[]; languages: string[]; specialties: string[];
  approvalStatus: string; isPublic: boolean; availability: (Slot & { id: string; timezone: string })[];
};
const err = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);

function ProfileCard({ p }: { p: TeacherProfile }) {
  const qc = useQueryClient();
  const [bio, setBio] = useState(p.bio ?? '');
  const [languages, setLanguages] = useState(p.languages);
  const [certs, setCerts] = useState(p.certifications.join(', '));
  const m = useMutation({
    mutationFn: () => api('/teachers/me', { method: 'PATCH', body: { bio: bio.trim(), languages, certifications: certs.split(',').map((c) => c.trim()).filter(Boolean) } }),
    onSuccess: () => { toast.success('Profile saved'); void qc.invalidateQueries({ queryKey: ['teacher', 'profile'] }); },
    onError: (e) => toast.error(err(e, 'Could not save profile')),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">Teaching profile {p.isPublic ? <Badge variant="success">shown on website</Badge> : <Badge variant="secondary">not public</Badge>}</CardTitle>
        <CardDescription>Students and parents see this. The academy decides whether it appears on the public Teachers page.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="About you" htmlFor="tp-bio"><Textarea id="tp-bio" rows={5} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
        <fieldset>
          <legend className="text-sm font-medium">Languages you teach in</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {LANGUAGES.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <Checkbox checked={languages.includes(l)} onChange={(e) => setLanguages((x) => (e.target.checked ? [...x, l] : x.filter((y) => y !== l)))} /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Certifications" htmlFor="tp-certs" hint="Comma separated"><Input id="tp-certs" value={certs} onChange={(e) => setCerts(e.target.value)} /></Field>
        <div className="text-muted-foreground text-xs">
          <p>Experience: {p.experienceYears} years · Qualifications on file: {p.qualifications}</p>
          {p.specialties.length ? <p>Specialties (set by the academy): {p.specialties.join(', ')}</p> : null}
        </div>
        <Button onClick={() => m.mutate()} disabled={m.isPending || !languages.length} className="justify-self-start">{m.isPending ? <Loader2 className="animate-spin" /> : null} Save profile</Button>
      </CardContent>
    </Card>
  );
}

function AvailabilityCard({ p }: { p: TeacherProfile }) {
  const qc = useQueryClient();
  const tz = useAuthStore((s) => s.user?.timezone ?? 'UTC');
  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => setSlots(p.availability.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }))), [p.availability]);
  const setSlot = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const invalid = slots.some((s) => s.startTime >= s.endTime);
  const m = useMutation({
    mutationFn: () => api('/teachers/me/availability', { method: 'PUT', body: { slots: [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)) } }),
    onSuccess: () => { toast.success('Availability saved'); void qc.invalidateQueries({ queryKey: ['teacher', 'profile'] }); },
    onError: (e) => toast.error(err(e, 'Could not save availability')),
  });
  const savedTz = p.availability[0]?.timezone;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly availability</CardTitle>
        <CardDescription>
          The academy schedules your classes within these hours. Times are in your time zone ({tz.replace(/_/g, ' ')}).
          {savedTz && savedTz !== tz ? ` Saved slots were entered in ${savedTz.replace(/_/g, ' ')} — saving again stores them in your current zone.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {slots.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
            <Select aria-label="Day" value={s.dayOfWeek} onChange={(e) => setSlot(i, { dayOfWeek: Number(e.target.value) })}>
              {DAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
            </Select>
            <Input aria-label="From" type="time" className="w-28" value={s.startTime} onChange={(e) => setSlot(i, { startTime: e.target.value })} />
            <Input aria-label="To" type="time" className="w-28" value={s.endTime} aria-invalid={s.startTime >= s.endTime} onChange={(e) => setSlot(i, { endTime: e.target.value })} />
            <Button variant="ghost" size="icon" aria-label="Remove slot" onClick={() => setSlots((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        {!slots.length ? <p className="text-muted-foreground text-sm">No availability — you won’t be scheduled for new classes.</p> : null}
        {invalid ? <p className="text-destructive text-xs">Each slot must end after it starts.</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={slots.length >= 42} onClick={() => setSlots((x) => [...x, { dayOfWeek: 1, startTime: '17:00', endTime: '21:00' }])}><Plus /> Add slot</Button>
          <Button onClick={() => m.mutate()} disabled={invalid || m.isPending}>{m.isPending ? <Loader2 className="animate-spin" /> : null} Save availability</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeacherProfilePage() {
  const q = useQuery({ queryKey: ['teacher', 'profile'], queryFn: () => api<TeacherProfile>('/teachers/me') });
  return (
    <>
      <PageTitle title="Profile & availability" />
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <ProfileCard p={q.data} />
          <AvailabilityCard p={q.data} />
        </div>
      )}
    </>
  );
}
