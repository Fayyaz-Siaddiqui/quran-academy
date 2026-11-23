'use client';

import type { NotificationPayload } from '@qa/shared-types';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { cn, formatDateTime } from '@/lib/utils';

type Page = { items: NotificationPayload[]; nextCursor: string | null; unreadCount: number };

export default function NotificationsPage() {
  const tz = useAuthStore((s) => s.user?.timezone);
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam }) => api<Page>(`/notifications${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api('/notifications/read', { method: 'POST', body: { ids } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = q.data?.pages[0]?.unreadCount ?? 0;

  return (
    <>
      <PageTitle
        title="Notifications"
        description={unread ? `${unread} unread` : 'You are all caught up'}
        actions={unread ? <Button variant="outline" size="sm" onClick={() => markRead.mutate(undefined)}><CheckCheck /> Mark all read</Button> : null}
      />
      <Card>
        <CardContent>
          {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : items.length ? (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={cn('flex gap-3 py-3', !n.readAt && 'font-medium')}>
                  <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} aria-label={n.readAt ? undefined : 'Unread'} />
                  <div className="min-w-0 flex-1">
                    <p>{n.title}</p>
                    <p className="text-muted-foreground text-sm font-normal">{n.body}</p>
                    <p className="text-muted-foreground mt-1 text-xs font-normal">{formatDateTime(n.createdAt, tz)}</p>
                  </div>
                  {!n.readAt ? <Button size="sm" variant="ghost" onClick={() => markRead.mutate([n.id])}>Mark read</Button> : null}
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Bell} title="No notifications yet" />}
          {q.hasNextPage ? <Button variant="outline" className="mt-4 w-full" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>Load more</Button> : null}
        </CardContent>
      </Card>
    </>
  );
}
