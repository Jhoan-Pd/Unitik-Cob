import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

export type DependencyStatus = 'up' | 'down' | 'not_configured';

export interface HealthReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  timezone: string;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
    routerboard: DependencyStatus;
    whatsapp: DependencyStatus;
    paymentGateway: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    // External integrations are wired in later OpenUP iterations (3-6);
    // they report "not_configured" until their modules exist.
    const dependencies: HealthReport['dependencies'] = {
      database,
      redis,
      routerboard: 'not_configured',
      whatsapp: 'not_configured',
      paymentGateway: 'not_configured',
    };

    const critical: DependencyStatus[] = [database, redis];
    return {
      status: critical.every((s) => s === 'up') ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      timezone: process.env.TZ ?? 'America/Bogota',
      dependencies,
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    } finally {
      redis.disconnect();
    }
  }
}
