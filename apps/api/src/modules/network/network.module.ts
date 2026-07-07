import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RECONNECTION_QUEUE } from '../../queues/queues.module';
import { MikrotikService } from './mikrotik.service';
import { PaymentValidatedListener } from './payment-validated.listener';
import { ReconnectionProcessor } from './reconnection.processor';

@Module({
  imports: [BullModule.registerQueue({ name: RECONNECTION_QUEUE })],
  providers: [MikrotikService, PaymentValidatedListener, ReconnectionProcessor],
  exports: [MikrotikService],
})
export class NetworkModule {}
