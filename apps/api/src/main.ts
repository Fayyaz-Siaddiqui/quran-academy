import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_PREFIX } from '@qa/config';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

// Prisma returns BigInt for large columns (recording sizes); make them JSON-safe.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Raw body is required to verify Zoom webhook signatures.
    rawBody: true,
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS', 1));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS', '').split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: undefined });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  if (config.get<string>('NODE_ENV') !== 'production' || config.get<boolean>('SWAGGER_ENABLED')) {
    const doc = new DocumentBuilder()
      .setTitle('Quran Academy API')
      .setDescription('REST API for the International Online Quran Academy & LMS platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  logger.log(`API listening on :${port} (prefix /${API_PREFIX})`);
}

void bootstrap();
