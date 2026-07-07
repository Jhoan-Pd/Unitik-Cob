import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';

/**
 * Billing schedulers — always America/Bogota (golden rule #8).
 * Local DB work runs directly; external calls (DIAN, notifications) travel
 * through BullMQ queues elsewhere.
 */
@Injectable()
export class BillingCron {
  private readonly logger = new Logger(BillingCron.name);

  constructor(private readonly billingService: BillingService) {}

  /** Day 1 of every month, 01:00 — generate the monthly invoices. */
  @Cron('0 1 1 * *', { timeZone: 'America/Bogota' })
  async monthlyGeneration(): Promise<void> {
    const { created } = await this.billingService.generateMonthlyInvoices();
    this.logger.log(`Cron mensual: ${created} facturas generadas`);
  }

  /** Every day at 03:00 — overdue marking, interest and double billing. */
  @Cron('0 3 * * *', { timeZone: 'America/Bogota' })
  async dailyOverdue(): Promise<void> {
    const { marked, doubled } = await this.billingService.applyOverdueRules();
    this.logger.log(`Cron de mora: ${marked} vencidas, ${doubled} con doble mensualidad`);
  }
}
