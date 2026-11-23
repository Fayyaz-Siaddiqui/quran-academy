'use client';

import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

type State = { kind: 'loading' } | { kind: 'active' } | { kind: 'pending-approval' } | { kind: 'error'; message: string };

function Verify() {
  const token = useSearchParams()!.get('token');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // tokens are single-use; avoid double submit in StrictMode
    ran.current = true;
    if (!token) return setState({ kind: 'error', message: 'This link is missing its token.' });
    api<{ status: string }>('/auth/verify-email', { method: 'POST', body: { token }, auth: false })
      .then((r) => setState(r.status === 'PENDING_APPROVAL' ? { kind: 'pending-approval' } : { kind: 'active' }))
      .catch((e) => setState({ kind: 'error', message: e instanceof ApiError ? e.message : 'Verification failed' }));
  }, [token]);

  if (state.kind === 'loading') return <p className="flex items-center gap-2"><Loader2 className="animate-spin" /> Verifying your email…</p>;
  if (state.kind === 'error') {
    return (
      <div role="alert">
        <XCircle className="text-destructive size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Link not valid</h1>
        <p className="text-muted-foreground mt-2">{state.message} Sign in to request a new verification email.</p>
        <Button className="mt-8" asChild><Link href="/login">Go to log in</Link></Button>
      </div>
    );
  }
  if (state.kind === 'pending-approval') {
    return (
      <div role="status">
        <Clock className="text-warning size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Email verified</h1>
        <p className="text-muted-foreground mt-2">Thank you. Your teacher application is now with our academic team for review. We will email you as soon as a decision is made.</p>
        <Button variant="outline" className="mt-8" asChild><Link href="/">Back to the website</Link></Button>
      </div>
    );
  }
  return (
    <div role="status">
      <CheckCircle2 className="text-success size-10" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">Email verified</h1>
      <p className="text-muted-foreground mt-2">Your account is active. You can now log in.</p>
      <Button className="mt-8" asChild><Link href="/login">Log in</Link></Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
