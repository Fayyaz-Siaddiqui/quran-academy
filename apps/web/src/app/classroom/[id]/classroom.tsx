'use client';

import { Loader2, Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { homeFor, useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

type JoinInfo = {
  classSessionId: string;
  title: string;
  courseTitle: string;
  endsAt: string;
  token: string;
  sessionName: string;
  userName: string;
  role: 'host' | 'participant';
  /** 'zoom' = in-page Video SDK; 'jitsi' = keyless fallback opened in a new tab. */
  provider: 'zoom' | 'jitsi';
  roomUrl?: string;
};

/* Minimal structural types for the parts of @zoom/videosdk we use (loaded dynamically, browser-only). */
type Participant = { userId: number; displayName: string; bVideoOn: boolean; muted?: boolean };
type ZoomStream = {
  startAudio(): Promise<unknown>;
  muteAudio(): Promise<unknown>;
  unmuteAudio(): Promise<unknown>;
  startVideo(): Promise<unknown>;
  stopVideo(): Promise<unknown>;
  attachVideo(userId: number, quality: number): Promise<HTMLElement | { type: string }>;
  detachVideo(userId: number): Promise<HTMLElement | HTMLElement[]>;
  startShareScreen(el: HTMLVideoElement | HTMLCanvasElement): Promise<unknown>;
  stopShareScreen(): Promise<unknown>;
  isCapturingVideo(): boolean;
};
type ZoomClient = {
  init(lang: string, assets: string, opts?: Record<string, unknown>): Promise<unknown>;
  join(topic: string, token: string, name: string): Promise<unknown>;
  leave(end?: boolean): Promise<unknown>;
  getMediaStream(): ZoomStream;
  getAllUser(): Participant[];
  getCurrentUserInfo(): Participant;
  on(event: string, cb: (payload: unknown) => void): void;
  off(event: string, cb: (payload: unknown) => void): void;
};

const VIDEO_360P = 2;

/**
 * Live one-to-one classroom on Zoom Video SDK. The API issues a short-lived,
 * class-specific JWT (host for the teacher, participant otherwise); joining,
 * attendance and recordings are reconciled server-side via Zoom webhooks.
 */
export function Classroom({ classId }: { classId: string }) {
  const router = useRouter();
  const { user, ready } = useAuthStore();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [state, setState] = useState<'loading' | 'joining' | 'joined' | 'jitsi' | 'error' | 'left'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const clientRef = useRef<ZoomClient | null>(null);
  const streamRef = useRef<ZoomStream | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const shareRef = useRef<HTMLVideoElement | null>(null);
  const tiles = useRef(new Map<number, HTMLElement>());

  // Render/remove each participant's video tile into a <video-player-container>.
  const syncVideo = useCallback(async () => {
    const client = clientRef.current;
    const stream = streamRef.current;
    const grid = gridRef.current;
    if (!client || !stream || !grid) return;
    const users = client.getAllUser();
    setParticipants(users);
    for (const u of users) {
      const has = tiles.current.has(u.userId);
      if (u.bVideoOn && !has) {
        const el = await stream.attachVideo(u.userId, VIDEO_360P);
        if (el instanceof HTMLElement) {
          el.setAttribute('data-user', String(u.userId));
          grid.appendChild(el);
          tiles.current.set(u.userId, el);
        }
      } else if (!u.bVideoOn && has) {
        await stream.detachVideo(u.userId).catch(() => undefined);
        tiles.current.get(u.userId)?.remove();
        tiles.current.delete(u.userId);
      }
    }
    for (const [id, el] of tiles.current) {
      if (!users.some((u) => u.userId === id)) {
        el.remove();
        tiles.current.delete(id);
      }
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=/classroom/${classId}`);
      return;
    }
    let cancelled = false;
    const onChange = () => void syncVideo();

    (async () => {
      try {
        // ?child=<id>: a parent joining on behalf of a young child (attendance goes to the child).
        const child = new URLSearchParams(window.location.search).get('child');
        const joinInfo = await api<JoinInfo>(`/classes/${classId}/join`, { method: 'POST', body: child ? { studentId: child } : {} });
        if (cancelled) return;
        setInfo(joinInfo);
        if (joinInfo.role === 'host') await api(`/classes/${classId}/start`, { method: 'POST' }).catch(() => undefined);
        if (joinInfo.provider === 'jitsi') {
          setState('jitsi');
          return;
        }

        setState('joining');
        const ZoomVideo = (await import('@zoom/videosdk')).default;
        const client = ZoomVideo.createClient() as unknown as ZoomClient;
        clientRef.current = client;
        await client.init('en-US', 'Global', { patchJsMedia: true, leaveOnPageUnload: true });
        await client.join(joinInfo.sessionName, joinInfo.token, joinInfo.userName);
        if (cancelled) return void client.leave();

        const stream = client.getMediaStream();
        streamRef.current = stream;
        ['user-added', 'user-removed', 'user-updated', 'peer-video-state-change'].forEach((e) => client.on(e, onChange));
        client.on('connection-change', (p) => {
          if ((p as { state?: string }).state === 'Closed') setState('left');
        });

        setState('joined');
        await stream.startAudio().catch(() => toast.warning('Could not start audio — check microphone permission.'));
        setMuted(false);
        await stream.startVideo().then(() => setVideoOn(true)).catch(() => toast.warning('Camera unavailable — you can still join with audio.'));
        await syncVideo();
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setError(e instanceof ApiError ? e.message : (e as { reason?: string })?.reason ?? 'Could not join the class');
      }
    })();

    return () => {
      cancelled = true;
      const client = clientRef.current;
      if (client) {
        ['user-added', 'user-removed', 'user-updated', 'peer-video-state-change'].forEach((e) => client.off(e, onChange));
        void client.leave().catch(() => undefined);
      }
    };
  }, [ready, user, classId, router, syncVideo]);

  const toggleMic = async () => {
    const s = streamRef.current;
    if (!s) return;
    if (muted) await s.unmuteAudio(); else await s.muteAudio();
    setMuted(!muted);
  };
  const toggleVideo = async () => {
    const s = streamRef.current;
    if (!s) return;
    if (videoOn) await s.stopVideo(); else await s.startVideo();
    setVideoOn(!videoOn);
    await syncVideo();
  };
  const toggleShare = async () => {
    const s = streamRef.current;
    if (!s || !shareRef.current) return;
    try {
      if (sharing) await s.stopShareScreen(); else await s.startShareScreen(shareRef.current);
      setSharing(!sharing);
    } catch {
      toast.error('Screen sharing is not available');
    }
  };
  const leave = async () => {
    const isHost = info?.role === 'host';
    if (isHost && confirm('End the class for everyone?')) {
      await clientRef.current?.leave(true).catch(() => undefined);
      await api(`/classes/${classId}/end`, { method: 'POST', body: {} }).catch(() => undefined);
    } else {
      await clientRef.current?.leave().catch(() => undefined);
    }
    setState('left');
  };

  if (state === 'jitsi' && info?.roomUrl) {
    const isHost = info.role === 'host';
    const endForEveryone = async () => {
      if (!confirm('End the class? Attendance will be finalised.')) return;
      await api(`/classes/${classId}/end`, { method: 'POST', body: {} }).catch(() => undefined);
      setState('left');
    };
    return (
      <main className="bg-sidebar text-sidebar-foreground flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
        <Video className="text-gold size-12" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold text-white">{info.title}</h1>
          <p className="mt-1 opacity-80">{info.courseTitle} · joining as {info.userName}</p>
        </div>
        <Button size="lg" variant="gold" asChild>
          <a href={info.roomUrl} target="_blank" rel="noopener noreferrer"><Video /> Open live class</a>
        </Button>
        <div className="max-w-md space-y-2 text-sm opacity-80">
          <p>The class opens in a new tab. Allow camera and microphone when your browser asks.</p>
          {isHost ? (
            <p className="text-gold">You are the teacher — open the class so your students can join you.</p>
          ) : (
            <p>If your teacher hasn’t arrived yet, keep the tab open — they will join you in the same room.</p>
          )}
        </div>
        <div className="flex gap-2">
          {isHost ? <Button variant="destructive" onClick={endForEveryone}><PhoneOff /> End class</Button> : null}
          <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => router.push(user ? homeFor(user) : '/')}>Back to dashboard</Button>
        </div>
      </main>
    );
  }

  if (state === 'error' || state === 'left') {
    return (
      <main className="bg-sidebar text-sidebar-foreground flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-white">{state === 'left' ? 'You have left the class' : 'Unable to join'}</h1>
        {error ? <p className="max-w-md opacity-80">{error}</p> : null}
        <Button variant="gold" onClick={() => router.push(user ? homeFor(user) : '/')}>Back to dashboard</Button>
      </main>
    );
  }

  return (
    <main className="bg-sidebar flex h-dvh flex-col text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{info?.title ?? 'Connecting…'}</p>
          <p className="truncate text-xs opacity-70">{info?.courseTitle}{participants.length ? ` · ${participants.length} in class` : ''}</p>
        </div>
        {info?.role === 'host' ? <span className="bg-gold rounded-full px-2.5 py-0.5 text-xs font-semibold text-black">Teacher</span> : null}
      </header>

      <section className="relative flex-1 overflow-auto p-4">
        {state !== 'joined' ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 opacity-80">
            <Loader2 className="size-8 animate-spin" />
            <p>{state === 'loading' ? 'Preparing your classroom…' : 'Joining the live class…'}</p>
          </div>
        ) : null}
        {/* Zoom requires attachVideo() targets to live inside a <video-player-container>. */}
        <div
          ref={(el) => {
            if (el && !gridRef.current) {
              const container = document.createElement('video-player-container');
              container.className = 'grid gap-4 sm:grid-cols-2';
              el.appendChild(container);
              gridRef.current = container as HTMLDivElement;
            }
          }}
          className={cn('mx-auto max-w-6xl', state !== 'joined' && 'hidden')}
        />
        <video ref={shareRef} className={cn('mx-auto mt-4 max-h-[50vh] rounded-lg', !sharing && 'hidden')} muted playsInline />
        {state === 'joined' && participants.length < 2 ? (
          <p className="mt-6 text-center text-sm opacity-70">Waiting for the {info?.role === 'host' ? 'student' : 'teacher'} to join…</p>
        ) : null}
      </section>

      <footer className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4">
        <Button size="icon" variant={muted ? 'destructive' : 'secondary'} onClick={toggleMic} disabled={state !== 'joined'} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <MicOff /> : <Mic />}
        </Button>
        <Button size="icon" variant={videoOn ? 'secondary' : 'destructive'} onClick={toggleVideo} disabled={state !== 'joined'} aria-label={videoOn ? 'Stop video' : 'Start video'}>
          {videoOn ? <Video /> : <VideoOff />}
        </Button>
        <Button size="icon" variant={sharing ? 'gold' : 'secondary'} onClick={toggleShare} disabled={state !== 'joined'} aria-label="Share screen">
          <MonitorUp />
        </Button>
        <Button variant="destructive" onClick={leave} disabled={state === 'loading'}>
          <PhoneOff /> {info?.role === 'host' ? 'End / leave' : 'Leave'}
        </Button>
      </footer>
    </main>
  );
}
