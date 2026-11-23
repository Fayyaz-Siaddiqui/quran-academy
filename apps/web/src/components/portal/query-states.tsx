'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );
}

export function ErrorBlock({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center gap-3 rounded-lg border p-8 text-center" role="alert">
      <AlertTriangle className="text-destructive size-6" />
      <p className="text-sm">{error instanceof Error ? error.message : 'Something went wrong.'}</p>
      {retry ? <Button size="sm" variant="outline" onClick={retry}>Try again</Button> : null}
    </div>
  );
}
