import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceStatus, SubscriptionStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ELECTRONIC_INVOICE_QUEUE } from '../../queues/queues.module';

export interface PortfolioSummary {
  totalPending: number;
  totalOverdue: number;
  overdueInvoices: number;
  pendingInvoices: number;
  byClient: Array<{
    clientId: string;
    clientCode: string;
    clientName: string;
    overdueAmount: number;
    overdueCount: number;
    oldestDueDate: Date;
  }>;
}

/**
 * Billing engine (Policy 1 — ISO/IEC 38500 Performance + Conformance).
 * Every parameter (interest rate, cut-off days, double-billing threshold)
 * comes from system_config — golden rule #3, nothing hardcoded.
 *
 * Interest model (documented for the thesis):
 * - When an invoice passes its due date it becomes OVERDUE and a one-time
 *   late interest of subtotal * interest_rate_percent/100 is applied.
 * - If the delay exceeds double_payment_after_days, one extra monthly fee
 *   is added once ("doble mensualidad", per the manager interview).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly auditService: AuditService,
    private readonly continuityPolicy: ServiceContinuityPolicy,
    @InjectQueue(ELECTRONIC_INVOICE_QUEUE) private readonly dianQueue: Queue,
  ) {}

  /** "2026-07" for America/Bogota now (or the given date). */
  currentPeriod(date = new Date()): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7);
  }

  /**
   * Generates the monthly invoice for every ACTIVE subscription.
   * Idempotent per (subscription, period): re-running never duplicates.
   */
  async generateMonthlyInvoices(period = this.currentPeriod()): Promise<{ created: number }> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true, client: true },
    });

    let created = 0;
    for (const subscription of subscriptions) {
      const invoiceNumber = `FCT-${period}-${subscription.client.clientCode}`;
      const exists = await this.prisma.invoice.findUnique({ where: { invoiceNumber } });
      if (exists) continue;

      const subtotal =
        Number(subscription.plan.monthlyPrice) +
        (subscription.plan.includesTv ? Number(subscription.plan.tvPrice ?? 0) : 0);

      const [year, month] = period.split('-').map(Number);
      const dueDate = new Date(Date.UTC(year, month - 1, subscription.cutOffDay, 12));

      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId: subscription.clientId,
          subscriptionId: subscription.id,
          period,
          issueDate: new Date(),
          dueDate,
          subtotal,
          total: subtotal,
        },
      });
      created += 1;

      await this.auditService.record({
        action: 'CREATE',
        entity: 'Invoice',
        entityId: invoice.id,
        newValues: { invoiceNumber, period, subtotal, generatedBy: 'monthly-cron' },
      });

      // DIAN electronic invoice: external provider → queued (golden rule #4)
      await this.dianQueue.add(
        'emit',
        { invoiceId: invoice.id },
        { ...this.continuityPolicy.criticalJobOptions(), jobId: `dian-${invoice.id}` },
      );
    }

    this.logger.log(`Facturación ${period}: ${created} facturas generadas`);
    return { created };
  }

  /**
   * Daily job: marks overdue invoices, applies one-time late interest and,
   * past the configured threshold, the double monthly fee.
   */
  async applyOverdueRules(now = new Date()): Promise<{ marked: number; doubled: number }> {
    const [ratePercent, doubleAfterDays] = await Promise.all([
      this.systemConfig.getNumber('interest_rate_percent'),
      this.systemConfig.getNumber('double_payment_after_days'),
    ]);

    // 1. PENDING past due → OVERDUE + one-time interest
    const toMark = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.PENDING, dueDate: { lt: now } },
    });
    for (const invoice of toMark) {
      const interest = Math.round(Number(invoice.subtotal) * (ratePercent / 100));
      const updated = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.OVERDUE,
          interest,
          total: Number(invoice.subtotal) + interest - Number(invoice.discount),
        },
      });
      await this.auditService.record({
        action: 'MARK_OVERDUE',
        entity: 'Invoice',
        entityId: invoice.id,
        oldValues: { status: invoice.status, total: Number(invoice.total) },
        newValues: { status: updated.status, interest, total: Number(updated.total) },
      });
    }

    // 2. OVERDUE beyond threshold → double monthly fee (applied once)
    const threshold = new Date(now.getTime() - doubleAfterDays * 86_400_000);
    const overdue = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.OVERDUE, dueDate: { lt: threshold } },
    });
    let doubled = 0;
    for (const invoice of overdue) {
      const alreadyDoubled =
        Number(invoice.total) >= Number(invoice.subtotal) * 2 + Number(invoice.interest);
      if (alreadyDoubled) continue;

      const updated = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { total: Number(invoice.total) + Number(invoice.subtotal) },
      });
      doubled += 1;
      await this.auditService.record({
        action: 'DOUBLE_BILLING',
        entity: 'Invoice',
        entityId: invoice.id,
        oldValues: { total: Number(invoice.total) },
        newValues: { total: Number(updated.total), afterDays: doubleAfterDays },
      });
    }

    return { marked: toMark.length, doubled };
  }

  /** Admin-approved discount with mandatory reason (audited by controller). */
  async applyDiscount(
    invoiceId: string,
    amount: number,
    _reason: string,
  ): Promise<{ invoice: Invoice; previous: Invoice }> {
    const previous = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!previous) throw new NotFoundException('Factura no encontrada');
    if (previous.status === InvoiceStatus.PAID || previous.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('No se puede descontar una factura pagada o anulada');
    }
    const newTotal =
      Number(previous.subtotal) + Number(previous.interest) - Number(previous.discount) - amount;
    if (newTotal < 0) throw new ConflictException('El descuento supera el total de la factura');

    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { discount: Number(previous.discount) + amount, total: newTotal },
    });
    return { invoice, previous };
  }

  /** Portfolio & delinquency view for admin/cashier. */
  async portfolio(): Promise<PortfolioSummary> {
    const open = await this.prisma.invoice.findMany({
      where: { status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PROMISE_TO_PAY] } },
      include: { client: { include: { user: true } } },
    });

    const byClientMap = new Map<string, PortfolioSummary['byClient'][number]>();
    let totalPending = 0;
    let totalOverdue = 0;
    let overdueInvoices = 0;

    for (const invoice of open) {
      const total = Number(invoice.total);
      totalPending += total;
      if (invoice.status === InvoiceStatus.OVERDUE) {
        totalOverdue += total;
        overdueInvoices += 1;
        const entry = byClientMap.get(invoice.clientId) ?? {
          clientId: invoice.clientId,
          clientCode: invoice.client.clientCode,
          clientName: `${invoice.client.user.firstName} ${invoice.client.user.lastName}`,
          overdueAmount: 0,
          overdueCount: 0,
          oldestDueDate: invoice.dueDate,
        };
        entry.overdueAmount += total;
        entry.overdueCount += 1;
        if (invoice.dueDate < entry.oldestDueDate) entry.oldestDueDate = invoice.dueDate;
        byClientMap.set(invoice.clientId, entry);
      }
    }

    return {
      totalPending,
      totalOverdue,
      overdueInvoices,
      pendingInvoices: open.length,
      byClient: [...byClientMap.values()].sort((a, b) => b.overdueAmount - a.overdueAmount),
    };
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return invoice;
  }

  findByNumber(invoiceNumber: string): Promise<Invoice | null> {
    return this.prisma.invoice.findUnique({ where: { invoiceNumber } });
  }
}
