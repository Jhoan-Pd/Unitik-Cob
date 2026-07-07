import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NetworkRateLimitGuard } from '../../common/guards/network-rate-limit.guard';
import { NETWORK_ACTIONS_QUEUE } from '../../queues/queues.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { MikrotikService } from './mikrotik.service';
import { NetworkActionsProcessor } from './network-actions.processor';
import { PaymentValidatedListener } from './payment-validated.listener';
import { SubscriptionChangedListener } from './subscription-changed.listener';
import { SuspensionCron } from './suspension.cron';

@Module({
  imports: [BullModule.registerQueue({ name: NETWORK_ACTIONS_QUEUE })],
  controllers: [DevicesController],
  providers: [
    MikrotikService,
    DevicesService,
    NetworkRateLimitGuard,
    NetworkActionsProcessor,
    PaymentValidatedListener,
    SubscriptionChangedListener,
    SuspensionCron,
  ],
  exports: [MikrotikService],
})
export class NetworkModule {}
