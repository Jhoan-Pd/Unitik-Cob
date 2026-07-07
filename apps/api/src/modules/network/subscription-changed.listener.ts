import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { PrismaService } from '../../prisma/prisma.service';
import { NETWORK_ACTIONS_QUEUE } from '../../queues/queues.module';
import { SubscriptionChangedEvent } from '../subscriptions/events/subscription-changed.event';
import { ProfileChangeJobData } from './network-actions.processor';

/**
 * Plan change → PPPoE profile change on the RouterBoard, queued
 * (RouterOS profiles are named after the plan, e.g. "Plan 2 Fibra").
 */
@Injectable()
export class SubscriptionChangedListener {
  private readonly logger = new Logger(SubscriptionChangedListener.name);

  constructor(
    @InjectQueue(NETWORK_ACTIONS_QUEUE) private readonly networkQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly continuityPolicy: ServiceContinuityPolicy,
  ) {}

  @OnEvent(SubscriptionChangedEvent.EVENT_NAME)
  async handle(event: SubscriptionChangedEvent): Promise<void> {
    const access = await this.prisma.networkAccess.findFirst({
      where: { clientId: event.clientId },
    });
    if (!access) {
      // Normal during installation: the technician creates the access later
      this.logger.log(
        `Suscripción ${event.subscriptionId} sin acceso de red todavía (instalación pendiente)`,
      );
      return;
    }

    const data: ProfileChangeJobData = {
      networkAccessId: access.id,
      clientId: event.clientId,
      newProfile: event.planName,
    };
    await this.networkQueue.add('change-profile', data, {
      ...this.continuityPolicy.criticalJobOptions(),
      jobId: `profile-${event.subscriptionId}`,
    });
    this.logger.log(`Cambio de perfil encolado: cliente ${event.clientId} → "${event.planName}"`);
  }
}
