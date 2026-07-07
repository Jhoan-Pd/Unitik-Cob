import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { MetricType, Phase } from '@prisma/client';
import { Job } from 'bullmq';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RECONNECTION_QUEUE } from '../../queues/queues.module';
import { MikrotikService } from './mikrotik.service';

export interface ReconnectionJobData {
  networkAccessId: string;
  clientId: string;
  paymentId: string;
  /** ISO timestamp of Payment.validatedAt — start of the SLA clock. */
  validatedAt: string;
}

// Static instance only for worker backoff wiring (pure class, no dependencies);
// the DI-managed instance is used everywhere else.
const continuity = new ServiceContinuityPolicy();

/**
 * Reconnection worker (Policies 1 y 4 — ISO/IEC 38500).
 * Consumes queued reconnections, executes them on the RouterBoard, audits the
 * action (RECONNECT) and records the RECONNECTION_TIME_MINUTES experimental
 * metric. Retries follow ServiceContinuityPolicy (1/5/15/30/60 min).
 */
@Processor(RECONNECTION_QUEUE, {
  settings: {
    backoffStrategy: (attemptsMade: number) => continuity.backoffDelayForAttempt(attemptsMade),
  },
})
export class ReconnectionProcessor extends WorkerHost {
  private readonly logger = new Logger(ReconnectionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mikrotik: MikrotikService,
    private readonly auditService: AuditService,
    private readonly continuityPolicy: ServiceContinuityPolicy,
  ) {
    super();
  }

  async process(job: Job<ReconnectionJobData>): Promise<void> {
    const { networkAccessId, clientId, paymentId, validatedAt } = job.data;

    const access = await this.prisma.networkAccess.findUnique({
      where: { id: networkAccessId },
      include: { device: true },
    });
    if (!access || !access.pppoeUser) {
      // Nothing to reconnect: audit the anomaly so it is visible, do not retry
      await this.auditService.record({
        action: 'RECONNECT_SKIPPED',
        entity: 'NetworkAccess',
        entityId: networkAccessId,
        newValues: { reason: 'NetworkAccess o usuario PPPoE inexistente', paymentId },
        policyRef: 'ISO/IEC 38500 - Responsabilidad',
      });
      return;
    }

    // May throw (device unreachable) → BullMQ retries per continuity policy
    await this.mikrotik.enableClient(access.deviceId, access.pppoeUser);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.networkAccess.update({
        where: { id: access.id },
        data: { isEnabled: true, lastAction: 'reconnected', lastActionAt: now },
      }),
      this.prisma.client.update({
        where: { id: clientId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    await this.auditService.record({
      action: 'RECONNECT',
      entity: 'NetworkAccess',
      entityId: access.id,
      oldValues: { isEnabled: access.isEnabled, lastAction: access.lastAction },
      newValues: { isEnabled: true, lastAction: 'reconnected', paymentId },
      policyRef: 'ISO/IEC 38500 - Responsabilidad',
    });

    // Experimental metric: minutes from payment validation to reconnection
    const minutes = (now.getTime() - new Date(validatedAt).getTime()) / 60_000;
    await this.prisma.operationalMetric.create({
      data: {
        metricType: MetricType.RECONNECTION_TIME_MINUTES,
        phase: Phase.POST_INTERVENTION,
        value: Math.round(minutes * 100) / 100,
        contextJson: { paymentId, clientId, networkAccessId: access.id },
      },
    });

    const sla = 5; // minutes — PaymentReconnectionPolicy.reconnectionSlaMinutes()
    this.logger.log(
      `Reconnected client=${clientId} in ${minutes.toFixed(2)} min (SLA ${sla} min, attempt ${job.attemptsMade + 1}/${this.continuityPolicy.maxAttempts()})`,
    );
  }
}
