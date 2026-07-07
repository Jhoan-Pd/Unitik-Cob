import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentPromise } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Payment promises (7 or 15 extra days — policy from the manager interview).
 * ISO/IEC 38500: Human behaviour + Conformance — the client gets a formal,
 * audited grace period instead of an informal verbal agreement.
 */
@Injectable()
export class PromisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    invoiceId: string,
    daysExtension: number,
    approvedBy: string,
  ): Promise<PaymentPromise> {
    const maxDays = await this.systemConfig.getNumber('max_promise_days');
    if (daysExtension > maxDays) {
      throw new ConflictException(`La promesa no puede superar ${maxDays} días`);
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (invoice.status !== InvoiceStatus.PENDING && invoice.status !== InvoiceStatus.OVERDUE) {
      throw new ConflictException(`La factura no admite promesa (estado: ${invoice.status})`);
    }

    const open = await this.prisma.paymentPromise.findFirst({
      where: { invoiceId, fulfilled: false, promiseDate: { gte: new Date() } },
    });
    if (open) throw new ConflictException('La factura ya tiene una promesa de pago vigente');

    const promiseDate = new Date(Date.now() + daysExtension * 86_400_000);
    const [promise] = await this.prisma.$transaction([
      this.prisma.paymentPromise.create({
        data: { clientId: invoice.clientId, invoiceId, promiseDate, daysExtension, approvedBy },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.PROMISE_TO_PAY },
      }),
    ]);
    return promise;
  }

  findByClient(clientId: string): Promise<PaymentPromise[]> {
    return this.prisma.paymentPromise.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Called by PaymentsService when a payment on the invoice is validated. */
  async markFulfilled(invoiceId: string): Promise<void> {
    await this.prisma.paymentPromise.updateMany({
      where: { invoiceId, fulfilled: false },
      data: { fulfilled: true },
    });
  }

  /** Daily job: expired unfulfilled promises send the invoice back to OVERDUE. */
  async expireBrokenPromises(now = new Date()): Promise<{ expired: number }> {
    const broken = await this.prisma.paymentPromise.findMany({
      where: { fulfilled: false, promiseDate: { lt: now } },
    });

    let expired = 0;
    for (const promise of broken) {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: promise.invoiceId } });
      if (!invoice || invoice.status !== InvoiceStatus.PROMISE_TO_PAY) continue;

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.OVERDUE },
      });
      expired += 1;
      await this.auditService.record({
        action: 'PROMISE_BROKEN',
        entity: 'Invoice',
        entityId: invoice.id,
        oldValues: { status: InvoiceStatus.PROMISE_TO_PAY, promiseDate: promise.promiseDate },
        newValues: { status: InvoiceStatus.OVERDUE },
      });
    }
    return { expired };
  }
}
