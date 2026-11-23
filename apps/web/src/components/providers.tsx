'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { ApiError, refreshSession } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

function SessionBootstrap() {
  useEffect(() => {
    // Restore the session from the httpOnly refresh cookie on first load.
    void refreshSession().finally(() => useAuthStore.getState().markReady());
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionBootstrap />
      {children}
      <Toaster richColors position="top-right" closeButton />
    </QueryClientProvider>
  );
}
