'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@qa/shared-validation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { api, ApiError } from '@/lib/api';

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const welcome = params.get('welcome') === '1';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = handleSubmit(async ({ token: t, password }) => {
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token: t, password }, auth: false });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reset password');
    }
  });

  if (!token) return <p className="text-destructive">This link is missing its token. Please use the link from your email.</p>;
  if (done) {
    return (
      <div role="status">
        <CheckCircle2 className="text-success size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Password {welcome ? 'set' : 'updated'}</h1>
        <p className="text-muted-foreground mt-2">You can now log in with your new password. For security, other devices have been signed out.</p>
        <Button className="mt-8" asChild><Link href="/login">Log in</Link></Button>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-bold">{welcome ? 'Set your password' : 'Choose a new password'}</h1>
      <p className="text-muted-foreground mt-2 text-sm">At least 10 characters with upper and lower case letters and a number.</p>
      <form onSubmit={onSubmit} className="mt-8 grid gap-5" noValidate>
        <input type="hidden" {...register('token')} />
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" autoFocus {...register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </Field>
        {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : null} Save password</Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
