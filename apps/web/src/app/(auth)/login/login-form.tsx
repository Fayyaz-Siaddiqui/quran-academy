'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { LoginResponse } from '@qa/shared-types';
import { loginSchema, twoFactorSchema } from '@qa/shared-validation';
import { Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { api, ApiError } from '@/lib/api';
import { homeFor, useAuthStore } from '@/lib/auth-store';

/** Only same-origin relative paths are accepted as post-login redirects. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const login = useForm({ resolver: zodResolver(loginSchema) });
  const otp = useForm({ resolver: zodResolver(twoFactorSchema) });

  const finish = (res: Exclude<LoginResponse, { twoFactorRequired: true }>) => {
    setSession(res.accessToken, res.user);
    router.replace(safeNext(params.get('next')) ?? homeFor(res.user));
  };

  const onLogin = login.handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await api<LoginResponse>('/auth/login', { method: 'POST', body: values, auth: false });
      if ('twoFactorRequired' in res) setChallenge(res.challengeToken);
      else finish(res);
    } catch (e) {
      setError(e instanceof ApiError ? { message: e.message, code: e.code } : { message: 'Unable to sign in' });
    }
  });

  const onOtp = otp.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const res = await api<LoginResponse>('/auth/login/2fa', { method: 'POST', body: { challengeToken: challenge, code }, auth: false });
      if (!('twoFactorRequired' in res)) finish(res);
    } catch (e) {
      setError({ message: e instanceof ApiError ? e.message : 'Verification failed' });
    }
  });

  const resend = async () => {
    const email = login.getValues('email');
    await api('/auth/resend-verification', { method: 'POST', body: { email }, auth: false }).catch(() => undefined);
    setError({ message: 'If your account is awaiting verification, a new link has been sent.' });
  };

  if (challenge) {
    return (
      <div>
        <ShieldCheck className="text-primary size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Two-step verification</h1>
        <p className="text-muted-foreground mt-2 text-sm">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={onOtp} className="mt-8 grid gap-5" noValidate>
          <Field label="Verification code" htmlFor="code" error={otp.formState.errors.code?.message}>
            <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus className="text-center text-lg tracking-[0.5em]" {...otp.register('code')} />
          </Field>
          {error ? <p className="text-destructive text-sm" role="alert">{error.message}</p> : null}
          <Button type="submit" size="lg" disabled={otp.formState.isSubmitting}>
            {otp.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null} Verify
          </Button>
          <Button type="button" variant="ghost" onClick={() => setChallenge(null)}>Back to sign in</Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        New here? <Link href="/register" className="text-primary font-medium hover:underline">Create an account</Link>
      </p>
      <form onSubmit={onLogin} className="mt-8 grid gap-5" noValidate>
        <Field label="Email" htmlFor="email" error={login.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus {...login.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={login.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...login.register('password')} />
        </Field>
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-primary text-sm hover:underline">Forgot password?</Link>
        </div>
        {error ? (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm" role="alert">
            {error.message}
            {error.code === 'ACCOUNT_PENDING_VERIFICATION' ? (
              <button type="button" onClick={resend} className="mt-1 block font-medium underline">Resend verification email</button>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" size="lg" disabled={login.formState.isSubmitting}>
          {login.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null} Log in
        </Button>
      </form>
    </div>
  );
}
