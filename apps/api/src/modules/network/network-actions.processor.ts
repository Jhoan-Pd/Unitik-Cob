import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ClientStatus, MetricType, Phase } from '@prisma/client';
import { Job } from 'bullmq';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NETWORK_ACTIONS_QUEUE } from '../../queues/queues.module';
import { MikrotikService } from './mikrotik.service';

export interface ReconnectionJobData {
  networkAccessId: string;
  clientId: string;
  paymentId: string;
  /** ISO timestamp of Payment.validatedAt — start of the SLA clock. */
  validatedAt: string;
}

export interface SuspensionJobData {
  networkAccessId: string;
  clientId: string;
  invoiceId: string;
  reason: string;
}

export interface ProfileChangeJobData {
  networkAccessId: string;
  clientId: string;
  newProfile: string;
}

const POLICY_REF = 'ISO/IEC 38500 - Responsabilidad';

// Static instance only for worker backoff wiring (pure class, no deps);
// the DI-managed instance is used everywhere else.
const continuity = new ServiceContinuityPolicy();

/**
 * Network actions worker (Policies 1, 2 y 4 — ISO/IEC 38500).
 * One queue, three job types: reconnect (payment validated), suspend
 * (overdue invoice past grace period) and change-profile (plan change).
 * Every action is audited and retried per the continuity policy.
 */
@Processor(NETWORK_ACTIONS_QUEUE, {
  settings: {
    backoffStrategy: (attemptsMade: number) => continuity.backoffDelayForAttempt(attemptsMade),
  },
})
export class NetworkActionsProcessor extends WorkerHost {
  private readonly logger = new Logger(NetworkActionsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mikrotik: MikrotikService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'reconnect':
        return this.reconnect(job as Job<ReconnectionJobData>);
      case 'suspend':
        return this.suspend(job as Job<SuspensionJobData>);
      case 'change-profile':
        return this.changeProfile(job as Job<ProfileChangeJobData>);
      default:
        this.logger.warn(`Job desconocido en la cola de red: ${job.name}`);
    }
  }

  private async reconnect(job: Job<ReconnectionJobData>): Promise<void> {
    const { networkAccessId, clientId, paymentId, validatedAt } = job.data;
    const access = await this.loadAccess(networkAccessId, `pago ${paymentId}`);
    if (!access) return;

    await this.mikrotik.enableClient(access.deviceId, access.pppoeUser as string);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.networkAccess.update({
        where: { id: access.id },
        data: { isEnabled: true, lastAction: 'reconnected', lastActionAt: now },
      }),
      this.prisma.client.update({ where: { id: clientId }, data: { status: ClientStatus.ACTIVE } }),
    ]);

    await this.auditService.record({
      action: 'RECONNECT',
      entity: 'NetworkAccess',
      entityId: access.id,
      oldValues: { isEnabled: access.isEnabled, lastAction: access.lastAction },
      newValues: { isEnabled: true, lastAction: 'reconnected', paymentId },
      policyRef: POLICY_REF,
    });

    const minutes = (now.getTime() - new Date(validatedAt).getTime()) / 60_000;
    await this.prisma.operationalMetric.create({
      data: {
        metricType: MetricType.RECONNECTION_TIME_MINUTES,
        phase: Phase.POST_INTERVENTION,
        value: Math.round(minutes * 100) / 100,
        contextJson: { paymentId, clientId, networkAccessId: access.id },
      },
    });
    this.logger.log(`Reconectado cliente=${clientId} en ${minutes.toFixed(2)} min (SLA 5 min)`);
  }

  private async suspend(job: Job<SuspensionJobData>): Promise<void> {
    const { networkAccessId, clientId, invoiceId, reason } = job.data;
    const access = await this.loadAccess(networkAccessId, `factura ${invoiceId}`);
    if (!access) return;

    await this.mikrotik.disableClient(access.deviceId, access.pppoeUser as string);

    await this.prisma.$transaction([
      this.prisma.networkAccess.update({
        where: { id: access.id },
        data: { isEnabled: false, lastAction: 'disabled', lastActionAt: new Date() },
      }),
      this.prisma.client.update({
        where: { id: clientId },
        data: { status: ClientStatus.SUSPENDED },
      }),
    ]);

    await this.auditService.record({
      action: 'SUSPEND',
      entity: 'NetworkAccess',
      entityId: access.id,
      oldValues: { isEnabled: access.isEnabled, lastAction: access.lastAction },
      newValues: { isEnabled: false, lastAction: 'disabled', invoiceId, reason },
      policyRef: POLICY_REF,
    });
    this.logger.log(`Suspendido cliente=${clientId} por ${reason}`);
  }

  private async changeProfile(job: Job<ProfileChangeJobData>): Promise<void> {
    const { networkAccessId, clientId, newProfile } = job.data;
    const access = await this.loadAccess(networkAccessId, `perfil ${newProfile}`);
    if (!access) return;

    await this.mikrotik.changeUserProfile(access.deviceId, access.pppoeUser as string, newProfile);

    await this.prisma.networkAccess.update({
      where: { id: access.id },
      data: { lastAction: 'profile-changed', lastActionAt: new Date() },
    });
    await this.auditService.record({
      action: 'CHANGE_PROFILE',
      entity: 'NetworkAccess',
      entityId: access.id,
      newValues: { newProfile, clientId },
      policyRef: POLICY_REF,
    });
    this.logger.log(`Perfil PPPoE de cliente=${clientId} cambiado a "${newProfile}"`);
  }

  /** Loads the access or audits the anomaly (no retry for missing data). */
  private async loadAccess(networkAccessId: string, context: string) {
    const access = await this.prisma.networkAccess.findUnique({
      where: { id: networkAccessId },
      include: { device: true },
    });
    if (!access || !access.pppoeUser) {
      await this.auditService.record({
        action: 'NETWORK_ACTION_SKIPPED',
        entity: 'NetworkAccess',
        entityId: networkAccessId,
        newValues: { reason: 'NetworkAccess o usuario PPPoE inexistente', context },
        policyRef: POLICY_REF,
      });
      return null;
    }
    return access;
  }
}
