import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import Redis from 'ioredis';
import { Public } from './common/decorators';
import { PrismaService } from './prisma/prisma.service';
import { REDIS } from './redis/redis.module';

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness + readiness for load balancers and uptime monitors. */
  @Get()
  async check() {
    const [db, cache] = await Promise.allSettled([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]);
    const status = { database: db.status === 'fulfilled' ? 'up' : 'down', redis: cache.status === 'fulfilled' ? 'up' : 'down' };
    if (status.database === 'down' || status.redis === 'down') throw new ServiceUnavailableException(status);
    return { status: 'ok', ...status, time: new Date().toISOString() };
  }
}
