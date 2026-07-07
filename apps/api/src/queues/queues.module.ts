import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/** Queue names — critical operations only travel through these (golden rule #4). */
export const RECONNECTION_QUEUE = 'reconnection';

/**
 * BullMQ root connection (Service continuity policy — ISO/IEC 38500
 * Strategy + Performance). Redis persists with AOF, so queued work
 * survives restarts and Cumbitara's connectivity drops.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')),
          // Required by BullMQ workers (blocking connections)
          maxRetriesPerRequest: null,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
