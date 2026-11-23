'use client';

import { SOCKET_EVENTS } from '@qa/config';
import type { NotificationPayload } from '@qa/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { API_URL } from './api';
import { useAuthStore } from './auth-store';

/**
 * Connects to the API's Socket.IO gateway while signed in. New notifications
 * show a toast and refresh cached queries that depend on them.
 */
export function useRealtime() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  useEffect(() => {
    // Off on serverless hosts (no long-lived Socket.IO server); pages still refresh via queries.
    if (!token || process.env.NEXT_PUBLIC_REALTIME === 'off') return;
    // Polling first, then upgrade: works directly and through the same-origin HTTP proxy.
    const socket: Socket = io(`${API_URL}/realtime`, { auth: { token }, transports: ['polling', 'websocket'], withCredentials: true });

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, (n: NotificationPayload) => {
      toast(n.title, { description: n.body });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      if (n.type.startsWith('class.') || n.type.startsWith('homework.') || n.type.startsWith('recording.') || n.type.startsWith('progress.')) {
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
        void qc.invalidateQueries({ queryKey: ['classes'] });
      }
    });
    socket.on(SOCKET_EVENTS.NOTIFICATION_READ, () => void qc.invalidateQueries({ queryKey: ['notifications'] }));
    socket.on(SOCKET_EVENTS.CLASS_STATUS, () => {
      void qc.invalidateQueries({ queryKey: ['classes'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    });
    socket.on(SOCKET_EVENTS.ANNOUNCEMENT_NEW, (a: { title: string }) => {
      toast.info(`Announcement: ${a.title}`);
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [token, qc]);
}
