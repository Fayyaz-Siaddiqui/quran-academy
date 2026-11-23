import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Runs the NestJS API inside this Next.js deployment (one Vercel project, same origin).
 * Only used when no external API is configured; with API_PROXY_TARGET the rewrites in
 * next.config.ts take precedence and forward /api/v1 elsewhere.
 */
export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
  maxDuration: 60,
};

type NestHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
let handler: NestHandler | undefined;

export default async function api(req: NextApiRequest, res: NextApiResponse) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  handler ??= (require('@qa/api/dist/serverless') as { handler: NestHandler }).handler;
  try {
    await handler(req, res);
  } catch (err) {
    console.error('API boot failed', err);
    if (!res.headersSent) res.status(503).json({ message: 'Service is starting, please retry', code: 'API_UNAVAILABLE' });
  }
}
