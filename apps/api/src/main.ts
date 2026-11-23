import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_PREFIX } from '@qa/config';
import { createApp } from './app.factory';

async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  const port = app.get(ConfigService).get<number>('PORT', 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on :${port} (prefix /${API_PREFIX})`);
}

void bootstrap();
