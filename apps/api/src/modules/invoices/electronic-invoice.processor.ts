import { createHash } from 'node:crypto';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { PrismaService } from '../../prisma/prisma.service';
import { ELECTRONIC_INVOICE_QUEUE } from '../../queues/queues.module';

export interface ElectronicInvoiceJobData {
  invoiceId: string;
}

const continuity = new ServiceContinuityPolicy();

/**
 * DIAN electronic invoicing worker (Alegra/Siigo — external provider, so it
 * ALWAYS goes through the queue, golden rule #4). MOCK mode by default:
 * generates a deterministic CUFE so the rest of the system (portal download,
 * reports) can be built; the real provider call lands when UNITIK contracts
 * Alegra or Siigo (Phase 4 decision, risk R-08).
 */
@Processor(ELECTRONIC_INVOICE_QUEUE, {
  settings: {
    backoffStrategy: (attemptsMade: number) => continuity.backoffDelayForAttempt(attemptsMade),
  },
})
export class ElectronicInvoiceProcessor extends WorkerHost {
  private readonly logger = new Logger(ElectronicInvoiceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<ElectronicInvoiceJobData>): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: job.data.invoiceId } });
    if (!invoice || invoice.electronicInvoiceCufe) return; // idempotent

    if (this.configService.get<string>('DIAN_MOCK', 'true') === 'false') {
      throw new Error('Proveedor DIAN real (Alegra/Siigo) pendiente de contratación (R-08)');
    }

    // MOCK: deterministic CUFE derived from the invoice number
    const cufe = createHash('sha256').update(`CUFE-${invoice.invoiceNumber}`).digest('hex');
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        electronicInvoiceCufe: cufe,
        electronicInvoiceUrl: `https://dian.mock.unitik.co/facturas/${invoice.invoiceNumber}.pdf`,
      },
    });

    await this.auditService.record({
      action: 'ELECTRONIC_INVOICE',
      entity: 'Invoice',
      entityId: invoice.id,
      newValues: { cufe, provider: 'MOCK' },
    });
    this.logger.log(`Factura electrónica emitida (mock): ${invoice.invoiceNumber}`);
  }
}
