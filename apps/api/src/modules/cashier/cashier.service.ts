import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  InvoiceStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaymentReconnectionPolicy } from '../governance/payment-reconnection.policy';
import { PromisesService } from '../promises/promises.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentValidatedEvent } from '../payments/events/payment-validated.event';
import { ReceiveCashDto } from './dto/receive-cash.dto';

export interface CashReceipt {
  receiptNumber: string;
  payment: Payment;
  invoiceNumber: string;
  clientName: string;
  receivedBy: string;
}

export interface DailyClose {
  date: string;
  cashierId: string;
  totalReceived: number;
  paymentsCount: number;
  payments: Array<{
    receiptTime: Date;
    invoiceNumber: string;
    clientName: string;
    amount: number;
  }>;
}

/**
 * Cashier operations (cash is received face-to-face, so the payment is
 * validated on the spot by the cashier — Policy 1 allows CASHIER to
 * validate; no proof is required for CASH).
 */
@Injectable()
export class CashierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly promisesService: PromisesService,
  ) {}

  async receiveCash(dto: ReceiveCashDto, cashier: AuthenticatedUser): Promise<CashReceipt> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: { client: { include: { user: true } } },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(`La factura ya está ${invoice.status === InvoiceStatus.PAID ? 'pagada' : 'anulada'}`);
    }

    const validatedAt = new Date();
    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: dto.amount,
          paymentMethod: PaymentMethod.CASH,
          status: PaymentStatus.VALIDATED,
          validatedBy: cashier.id,
          validatedAt,
          paidAt: validatedAt,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID },
      }),
    ]);

    await this.promisesService.markFulfilled(invoice.id);
    this.eventEmitter.emit(
      PaymentReconnectionPolicy.PAYMENT_VALIDATED_EVENT,
      new PaymentValidatedEvent(payment.id, invoice.id, invoice.clientId, validatedAt),
    );

    // Receipt number: REC-YYYYMMDD-<daily sequence>
    const dayStart = new Date(validatedAt);
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.payment.count({
      where: { paymentMethod: PaymentMethod.CASH, paidAt: { gte: dayStart } },
    });
    const ymd = validatedAt.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).replace(/-/g, '');

    return {
      receiptNumber: `REC-${ymd}-${String(todayCount).padStart(4, '0')}`,
      payment,
      invoiceNumber: invoice.invoiceNumber,
      clientName: `${invoice.client.user.firstName} ${invoice.client.user.lastName}`,
      receivedBy: cashier.email,
    };
  }

  /** Daily cash close: everything this cashier received on the given date. */
  async dailyClose(cashier: AuthenticatedUser, dateIso?: string): Promise<DailyClose> {
    const date = dateIso ? new Date(dateIso) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000);

    const payments = await this.prisma.payment.findMany({
      where: {
        paymentMethod: PaymentMethod.CASH,
        validatedBy: cashier.id,
        paidAt: { gte: start, lt: end },
      },
      include: { invoice: { include: { client: { include: { user: true } } } } },
      orderBy: { paidAt: 'asc' },
    });

    return {
      date: start.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      cashierId: cashier.id,
      totalReceived: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      paymentsCount: payments.length,
      payments: payments.map((p) => ({
        receiptTime: p.paidAt,
        invoiceNumber: p.invoice.invoiceNumber,
        clientName: `${p.invoice.client.user.firstName} ${p.invoice.client.user.lastName}`,
        amount: Number(p.amount),
      })),
    };
  }

  /** Client account status: open invoices and recent payments. */
  async accountStatus(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: true },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const [openInvoices, recentPayments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          clientId,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PROMISE_TO_PAY] },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { invoice: { clientId }, status: PaymentStatus.VALIDATED },
        orderBy: { paidAt: 'desc' },
        take: 12,
      }),
    ]);

    return {
      client: {
        clientCode: client.clientCode,
        name: `${client.user.firstName} ${client.user.lastName}`,
        status: client.status,
      },
      totalDue: openInvoices.reduce((sum, i) => sum + Number(i.total), 0),
      openInvoices,
      recentPayments,
    };
  }
}
