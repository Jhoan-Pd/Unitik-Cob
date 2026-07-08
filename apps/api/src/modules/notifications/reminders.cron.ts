import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceStatus, NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Automatic reminders (Human behaviour + Performance): clients are warned
 * before actions are taken against the service. Idempotent per day.
 */
@Injectable()
export class RemindersCron {
  private readonly logger = new Logger(RemindersCron.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Daily 08:00 America/Bogota. */
  @Cron('0 8 * * *', { timeZone: 'America/Bogota' })
  async run(): Promise<{ overdue: number; promises: number }> {
    return this.sendReminders();
  }

  async sendReminders(now = new Date()): Promise<{ overdue: number; promises: number }> {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    // 1. OVERDUE_REMINDER: one per client per day while invoices stay overdue
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.OVERDUE },
      select: { clientId: true, invoiceNumber: true, total: true },
    });
    let overdueSent = 0;
    const seenClients = new Set<string>();
    for (const invoice of overdueInvoices) {
      if (seenClients.has(invoice.clientId)) continue;
      seenClients.add(invoice.clientId);

      const alreadyToday = await this.prisma.notification.findFirst({
        where: {
          clientId: invoice.clientId,
          type: 'OVERDUE_REMINDER',
          createdAt: { gte: dayStart },
        },
      });
      if (alreadyToday) continue;

      await this.prisma.notification.createMany({
        data: [NotificationChannel.IN_APP, NotificationChannel.WHATSAPP].map((channel) => ({
          clientId: invoice.clientId,
          channel,
          type: 'OVERDUE_REMINDER',
          content: `Su factura ${invoice.invoiceNumber} está vencida. Evite la suspensión del servicio pagando o solicitando una promesa de pago.`,
        })),
      });
      overdueSent += 1;
    }

    // 2. PROMISE_REMINDER: promises expiring within 24 hours
    const expiring = await this.prisma.paymentPromise.findMany({
      where: {
        fulfilled: false,
        promiseDate: { gte: now, lte: new Date(now.getTime() + 86_400_000) },
      },
    });
    let promiseSent = 0;
    for (const promise of expiring) {
      const alreadyToday = await this.prisma.notification.findFirst({
        where: {
          clientId: promise.clientId,
          type: 'PROMISE_REMINDER',
          createdAt: { gte: dayStart },
        },
      });
      if (alreadyToday) continue;

      await this.prisma.notification.create({
        data: {
          clientId: promise.clientId,
          channel: NotificationChannel.IN_APP,
          type: 'PROMISE_REMINDER',
          content: `Su promesa de pago vence el ${promise.promiseDate.toLocaleDateString('es-CO')}. Cúmplala para evitar la suspensión.`,
        },
      });
      promiseSent += 1;
    }

    if (overdueSent + promiseSent > 0) {
      this.logger.log(`Recordatorios: ${overdueSent} de mora, ${promiseSent} de promesa`);
    }
    return { overdue: overdueSent, promises: promiseSent };
  }
}
