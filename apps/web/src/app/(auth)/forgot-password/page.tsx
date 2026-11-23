'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@qa/shared-validation';
import { Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotPasswordSchema) });
  const onSubmit = handleSubmit(async (values) => {
    await api('/auth/forgot-password', { method: 'POST', body: values, auth: false }).catch(() => undefined);
    setSent(true); // Same response whether or not the email exists.
  });

  if (sent) {
    return (
      <div role="status">
        <MailCheck className="text-primary size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
        <p className="text-muted-foreground mt-2">If an account exists for that address, we have sent a link to reset your password. It expires in 60 minutes.</p>
        <Button variant="outline" className="mt-8" asChild><Link href="/login">Back to log in</Link></Button>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="text-muted-foreground mt-2 text-sm">Enter your account email and we will send you a reset link.</p>
      <form onSubmit={onSubmit} className="mt-8 grid gap-5" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} />
        </Field>
        <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : null} Send reset link</Button>
        <Link href="/login" className="text-primary text-center text-sm hover:underline">Back to log in</Link>
      </form>
    </div>
  );
}
