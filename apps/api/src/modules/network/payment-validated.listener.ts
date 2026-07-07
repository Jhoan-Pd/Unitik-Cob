import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { PaymentReconnectionPolicy } from '../governance/payment-reconnection.policy';
import { PrismaService } from '../../prisma/prisma.service';
import { RECONNECTION_QUEUE } from '../../queues/queues.module';
import { PaymentValidatedEvent } from '../payments/events/payment-validated.event';
import { ReconnectionJobData } from './reconnection.processor';

/**
 * Bridges Policy 1 (payment → reconnection) with Policy 4 (continuity):
 * a validated payment NEVER calls the RouterBoard synchronously — it enqueues
 * a reconnection job with governance-defined retries (golden rule #4).
 */
@Injectable()
export class PaymentValidatedListener {
  private readonly logger = new Logger(PaymentValidatedListener.name);

  constructor(
    @InjectQueue(RECONNECTION_QUEUE) private readonly reconnectionQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly continuityPolicy: ServiceContinuityPolicy,
  ) {}

  @OnEvent(PaymentReconnectionPolicy.PAYMENT_VALIDATED_EVENT)
  async handle(event: PaymentValidatedEvent): Promise<void> {
    const access = await this.prisma.networkAccess.findFirst({
      where: { clientId: event.clientId },
    });
    if (!access) {
      this.logger.warn(
        `Pago ${event.paymentId} validado pero el cliente ${event.clientId} no tiene acceso de red registrado`,
      );
      return;
    }

    const data: ReconnectionJobData = {
      networkAccessId: access.id,
      clientId: event.clientId,
      paymentId: event.paymentId,
      validatedAt: event.validatedAt.toISOString(),
    };

    await this.reconnectionQueue.add('reconnect', data, {
      ...this.continuityPolicy.criticalJobOptions(),
      jobId: `reconnect-${event.paymentId}`, // idempotent per payment (BullMQ forbids ':' in ids)
    });
    this.logger.log(`Reconexión encolada para el pago ${event.paymentId}`);
  }
}
