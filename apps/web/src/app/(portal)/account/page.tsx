'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AuthUser } from '@qa/shared-types';
import { passwordSchema, z } from '@qa/shared-validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Monitor, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CountrySelect, TimezoneSelect } from '@/components/forms/pickers';
import { PageTitle } from '@/components/portal/portal-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime } from '@/lib/utils';

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone').or(z.literal('')),
  country: z.string().length(2, 'Select a country'),
  timezone: z.string().min(3),
});
const passwordForm = z
  .object({ currentPassword: z.string().min(1, 'Required'), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

const err = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function ProfileCard({ user }: { user: AuthUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.fullName, phone: '', country: user.country ?? '', timezone: user.timezone },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      const updated = await api<AuthUser>('/users/me', { method: 'PATCH', body: { ...v, phone: v.phone || undefined } });
      setUser(updated);
      toast.success('Profile updated');
    } catch (e) {
      toast.error(err(e, 'Could not update profile'));
    }
  });
  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Class times across the platform are shown in your time zone.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Full name" htmlFor="a-name" error={errors.fullName?.message}><Input id="a-name" {...register('fullName')} /></Field>
          <Field label="Email" htmlFor="a-email" hint="Contact support to change your email"><Input id="a-email" value={user.email} disabled /></Field>
          <Field label="Phone" htmlFor="a-phone" error={errors.phone?.message} hint="Leave blank to keep current"><Input id="a-phone" type="tel" {...register('phone')} /></Field>
          <Field label="Country" htmlFor="a-country" error={errors.country?.message}><CountrySelect id="a-country" {...register('country')} /></Field>
          <Field label="Time zone" htmlFor="a-tz" error={errors.timezone?.message} className="sm:col-span-2"><TimezoneSelect id="a-tz" {...register('timezone')} /></Field>
          <Button type="submit" disabled={isSubmitting || !isDirty} className="sm:col-span-2 sm:justify-self-start">{isSubmitting ? <Loader2 className="animate-spin" /> : null} Save changes</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(passwordForm) });
  const onSubmit = handleSubmit(async ({ currentPassword, password }) => {
    try {
      const r = await api<{ otherSessionsRevoked: number }>('/auth/change-password', { method: 'POST', body: { currentPassword, password } });
      toast.success(`Password changed${r.otherSessionsRevoked ? ` — signed out of ${r.otherSessionsRevoked} other device(s)` : ''}`);
      reset();
    } catch (e) {
      toast.error(err(e, 'Could not change password'));
    }
  });
  return (
    <Card>
      <CardHeader><CardTitle>Password</CardTitle><CardDescription>Changing your password signs out your other devices.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Current password" htmlFor="pw-cur" error={errors.currentPassword?.message}><Input id="pw-cur" type="password" autoComplete="current-password" {...register('currentPassword')} /></Field>
          <Field label="New password" htmlFor="pw-new" error={errors.password?.message}><Input id="pw-new" type="password" autoComplete="new-password" {...register('password')} /></Field>
          <Field label="Confirm new password" htmlFor="pw-conf" error={errors.confirmPassword?.message}><Input id="pw-conf" type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
          <Button type="submit" disabled={isSubmitting} className="justify-self-start">{isSubmitting ? <Loader2 className="animate-spin" /> : null} Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFactorCard({ user }: { user: AuthUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(err(e, 'Something went wrong')); } finally { setBusy(false); }
  };
  const start = () => run(async () => setSetup(await api('/auth/2fa/setup', { method: 'POST' })));
  const enable = () => run(async () => {
    await api('/auth/2fa/enable', { method: 'POST', body: { code } });
    setUser({ ...user, twoFactorEnabled: true });
    setSetup(null); setCode('');
    toast.success('Two-factor authentication enabled');
  });
  const disable = () => run(async () => {
    await api('/auth/2fa/disable', { method: 'POST', body: { code, password } });
    setUser({ ...user, twoFactorEnabled: false });
    setCode(''); setPassword('');
    toast.success('Two-factor authentication disabled');
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Two-factor authentication {user.twoFactorEnabled ? <Badge variant="success">On</Badge> : <Badge variant="secondary">Off</Badge>}</CardTitle>
        <CardDescription>Protect your account with a code from an authenticator app (Google Authenticator, Authy, 1Password).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user.twoFactorEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Current password" htmlFor="2fa-pw"><Input id="2fa-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Field label="Authenticator code" htmlFor="2fa-off"><Input id="2fa-off" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Button variant="destructive" onClick={disable} disabled={busy || code.length !== 6 || !password} className="justify-self-start"><ShieldOff /> Disable</Button>
          </div>
        ) : setup ? (
          <div className="grid items-start gap-6 sm:grid-cols-[180px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" className="size-44 rounded-md border bg-white p-2" />
            <div className="space-y-3">
              <p className="text-sm">Scan the QR code, or enter this key manually:</p>
              <code className="bg-muted block rounded px-2 py-1 text-xs break-all">{setup.secret}</code>
              <Field label="Enter the 6-digit code to confirm" htmlFor="2fa-on"><Input id="2fa-on" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
              <Button onClick={enable} disabled={busy || code.length !== 6}><ShieldCheck /> Enable</Button>
            </div>
          </div>
        ) : (
          <Button onClick={start} disabled={busy}><ShieldCheck /> Set up two-factor</Button>
        )}
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const qc = useQueryClient();
  const tz = useAuthStore((s) => s.user?.timezone);
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<{ id: string; userAgent: string | null; ipAddress: string | null; lastUsedAt: string; current: boolean }[]>('/auth/sessions'),
  });
  const activity = useQuery({
    queryKey: ['login-activity'],
    queryFn: () => api<{ id: string; success: boolean; reason: string | null; ipAddress: string | null; userAgent: string | null; createdAt: string }[]>('/auth/login-activity'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Device signed out'); void qc.invalidateQueries({ queryKey: ['sessions'] }); },
  });
  const device = (ua: string | null) => (ua ? (ua.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0]?.split('/')[0] ?? 'Browser') + (/(Mobile|Android|iPhone)/.test(ua) ? ' · mobile' : '') : 'Unknown device');

  return (
    <Card>
      <CardHeader><CardTitle>Devices & login activity</CardTitle><CardDescription>Sign out of any device you don’t recognise.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <ul className="divide-y">
          {sessions.data?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
              <Monitor className="text-muted-foreground size-5" />
              <div className="flex-1">
                <p className="font-medium">{device(s.userAgent)} {s.current ? <Badge variant="success" className="ml-1">This device</Badge> : null}</p>
                <p className="text-muted-foreground text-xs">{s.ipAddress ?? 'Unknown IP'} · last active {formatDateTime(s.lastUsedAt, tz)}</p>
              </div>
              {!s.current ? <Button size="sm" variant="outline" onClick={() => revoke.mutate(s.id)}>Sign out</Button> : null}
            </li>
          ))}
        </ul>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Recent sign-in attempts</h3>
          <ul className="space-y-1.5 text-xs">
            {activity.data?.slice(0, 10).map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2">
                <Badge variant={a.success ? 'success' : 'destructive'}>{a.success ? 'Success' : 'Failed'}</Badge>
                <span>{formatDateTime(a.createdAt, tz)}</span>
                <span className="text-muted-foreground">{a.ipAddress} · {device(a.userAgent)}{a.reason && !a.success ? ` · ${a.reason.replace(/_/g, ' ')}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <>
      <PageTitle title="Account & security" />
      <div className="grid gap-6 xl:grid-cols-2">
        <ProfileCard user={user} />
        <PasswordCard />
        <TwoFactorCard user={user} />
        <SessionsCard />
      </div>
    </>
  );
}
