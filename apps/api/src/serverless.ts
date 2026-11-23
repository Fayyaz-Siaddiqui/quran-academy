import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app.factory';

/**
 * Serverless entry (e.g. a Vercel function): the Nest app is created once per warm instance
 * and every request is handed to its Express instance. Realtime (Socket.IO) and queue workers
 * need a long-running process and are not served from here.
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let ready: Promise<Handler> | undefined;

function init(): Promise<Handler> {
  // Vercel Marketplace (Upstash) names the Redis URL KV_URL.
  process.env.REDIS_URL ??= process.env.KV_URL ?? process.env.UPSTASH_REDIS_URL;
  process.env.RUN_QUEUE_WORKERS ??= 'false';
  return createApp().then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as Handler;
  });
}

export async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  ready ??= init().catch((err) => {
    ready = undefined; // retry on the next request instead of caching a failed boot
    throw err;
  });
  const app = await ready;
  app(req, res);
}
