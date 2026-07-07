import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientStatus, InvoiceStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NETWORK_ACTIONS_QUEUE } from '../../queues/queues.module';
import { SuspensionJobData } from './network-actions.processor';

/**
 * Automatic suspension for overdue invoices past the grace period
 * (Policy 1 + 4). Runs daily; suspensions are QUEUED, never synchronous.
 * Invoices under an active payment promise are NOT suspended
 * (status PROMISE_TO_PAY is excluded).
 */
@Injectable()
export class SuspensionCron {
  private readonly logger = new Logger(SuspensionCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly continuityPolicy: ServiceContinuityPolicy,
    @InjectQueue(NETWORK_ACTIONS_QUEUE) private readonly networkQueue: Queue,
  ) {}

  /** Daily 05:00 America/Bogota. */
  @Cron('0 5 * * *', { timeZone: 'America/Bogota' })
  async run(): Promise<{ enqueued: number }> {
    return this.enqueueSuspensions();
  }

  async enqueueSuspensions(now = new Date()): Promise<{ enqueued: number }> {
    const graceDays = await this.systemConfig.getNumber('grace_period_days');
    const threshold = new Date(now.getTime() - graceDays * 86_400_000);

    const overdue = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.OVERDUE, // PROMISE_TO_PAY queda protegida
        dueDate: { lt: threshold },
        client: { status: ClientStatus.ACTIVE },
      },
      include: { client: true },
    });

    let enqueued = 0;
    for (const invoice of overdue) {
      const access = await this.prisma.networkAccess.findFirst({
        where: { clientId: invoice.clientId },
      });
      if (!access) {
        this.logger.warn(`Cliente ${invoice.client.clientCode} moroso sin acceso de red registrado`);
        continue;
      }

      const data: SuspensionJobData = {
        networkAccessId: access.id,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        reason: `Mora: factura ${invoice.invoiceNumber} vencida hace más de ${graceDays} días`,
      };
      const day = now.toISOString().slice(0, 10);
      await this.networkQueue.add('suspend', data, {
        ...this.continuityPolicy.criticalJobOptions(),
        jobId: `suspend-${invoice.clientId}-${day}`, // one per client per day
      });
      enqueued += 1;
    }

    if (enqueued > 0) this.logger.log(`Suspensiones encoladas: ${enqueued}`);
    return { enqueued };
  }
}
