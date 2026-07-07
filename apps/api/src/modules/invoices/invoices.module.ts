import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ELECTRONIC_INVOICE_QUEUE } from '../../queues/queues.module';
import { BillingCron } from './billing.cron';
import { BillingService } from './billing.service';
import { ElectronicInvoiceProcessor } from './electronic-invoice.processor';
import { InvoicesController } from './invoices.controller';

@Module({
  imports: [BullModule.registerQueue({ name: ELECTRONIC_INVOICE_QUEUE })],
  controllers: [InvoicesController],
  providers: [BillingService, BillingCron, ElectronicInvoiceProcessor],
  exports: [BillingService],
})
export class InvoicesModule {}
