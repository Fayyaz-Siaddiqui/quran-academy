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
  // Next adds the catch-all segment ("path" / "nxtPpath") to the query string; the API's strict
  // validation rejects unknown query params, so strip them before handing the request over.
  if (req.url?.includes('?')) {
    const url = new URL(req.url, 'http://internal');
    for (const key of [...url.searchParams.keys()]) if (key === 'path' || key.startsWith('nxtP')) url.searchParams.delete(key);
    req.url = url.pathname + (url.searchParams.size ? `?${url.searchParams}` : '');
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    handler ??= (require('@qa/api/dist/serverless') as { handler: NestHandler }).handler;
    await handler(req, res);
  } catch (err) {
    console.error('API boot failed', err);
    if (!res.headersSent) res.status(503).json({
        message: 'Service is starting, please retry',
        code: 'API_UNAVAILABLE',
        ...(process.env.DEBUG_API_ERRORS === '1' ? { detail: String((err as Error)?.message ?? err).slice(0, 500) } : {}),
      });
  }
}
