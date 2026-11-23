import type { Provider } from '@nestjs/common';

/**
 * BullMQ workers are long-running pollers. On serverless hosts (Vercel) set RUN_QUEUE_WORKERS=false:
 * the API still enqueues jobs, and a separate always-on worker process can consume them later.
 */
export function queueWorkers(...providers: Provider[]): Provider[] {
  return process.env.RUN_QUEUE_WORKERS === 'false' ? [] : providers;
}
