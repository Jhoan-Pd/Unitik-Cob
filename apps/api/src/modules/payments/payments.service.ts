import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  InvoiceStatus,
  NotificationChannel,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PaymentReconnectionPolicy } from '../governance/payment-reconnection.policy';
import { PromisesService } from '../promises/promises.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { ValidatePaymentDto } from './dto/validate-payment.dto';
import { PaymentValidatedEvent } from './events/payment-validated.event';
import { WompiEvent } from './wompi.service';

/**
 * Payment registration and validation (Policy 1 — ISO/IEC 38500
 * Performance + Conformance). Iteration 2 delivers the architectural
 * prototype of the critical flow; billing rules (interest, promises,
 * webhooks) are completed in Iteration 4.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PaymentReconnectionPolicy,
    private readonly eventEmitter: EventEmitter2,
    private readonly promisesService: PromisesService,
    private readonly auditService: AuditService,
  ) {}

  /** Registers a payment. Nequi/transfer always start PENDING_VALIDATION. */
  async register(dto: RegisterPaymentDto): Promise<Payment> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('La factura está anulada');
    }

    return this.prisma.payment.create({
      data: {
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        proofUrl: dto.proofUrl,
        status: PaymentStatus.PENDING_VALIDATION,
        paidAt: new Date(),
      },
    });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  /**
   * Manual validation (Policy 1): only ADMIN/CASHIER, proof required for
   * Nequi/transfer. Approving emits PaymentValidatedEvent → queued
   * reconnection. Rejecting records the reason and notifies the client.
   */
  async validate(
    paymentId: string,
    dto: ValidatePaymentDto,
    user: AuthenticatedUser,
  ): Promise<{ payment: Payment; previous: Payment }> {
    if (!this.policy.canValidateManually(user.role)) {
      throw new ForbiddenException('Solo el administrador o el cajero pueden validar pagos');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status !== PaymentStatus.PENDING_VALIDATION) {
      throw new ConflictException(`El pago ya fue procesado (estado: ${payment.status})`);
    }
    if (dto.approve && this.policy.requiresProof(payment.paymentMethod) && !payment.proofUrl) {
      throw new BadRequestException(
        'La validación manual de Nequi/transferencia exige el comprobante adjunto',
      );
    }

    const validatedAt = new Date();

    if (!dto.approve) {
      const [rejected] = await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.REJECTED, validatedBy: user.id, validatedAt },
        }),
        // Client is informed why the receipt was rejected (Policy 1, rule 5)
        this.prisma.notification.create({
          data: {
            clientId: payment.invoice.clientId,
            channel: NotificationChannel.IN_APP,
            type: 'PAYMENT_REJECTED',
            content: `Su comprobante fue rechazado: ${dto.reason}`,
          },
        }),
      ]);
      return { payment: rejected, previous: payment };
    }

    const [validated] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.VALIDATED, validatedBy: user.id, validatedAt },
      }),
      this.prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: InvoiceStatus.PAID },
      }),
    ]);

    // A validated payment fulfills any open promise on the invoice
    await this.promisesService.markFulfilled(payment.invoiceId);

    this.eventEmitter.emit(
      PaymentReconnectionPolicy.PAYMENT_VALIDATED_EVENT,
      new PaymentValidatedEvent(
        validated.id,
        payment.invoiceId,
        payment.invoice.clientId,
        validatedAt,
      ),
    );

    return { payment: validated, previous: payment };
  }

  /**
   * Wompi webhook (already signature-verified by the controller): the only
   * auto-validated path (Policy 1, rule 2). Idempotent per transaction id.
   */
  async processWompiEvent(event: WompiEvent): Promise<{ processed: boolean; reason?: string }> {
    const transaction = event.data.transaction;
    if (event.event !== 'transaction.updated' || transaction.status !== 'APPROVED') {
      return { processed: false, reason: `Evento ignorado (${transaction.status})` };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: transaction.reference },
    });
    if (!invoice) {
      this.logger.warn(`Webhook Wompi con referencia desconocida: ${transaction.reference}`);
      return { processed: false, reason: 'Referencia desconocida' };
    }

    const duplicate = await this.prisma.payment.findFirst({
      where: { reference: transaction.id },
    });
    if (duplicate) return { processed: false, reason: 'Transacción ya procesada' };

    const validatedAt = new Date();
    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: transaction.amount_in_cents / 100,
          paymentMethod: PaymentMethod.ONLINE_GATEWAY,
          reference: transaction.id,
          status: PaymentStatus.VALIDATED,
          autoValidated: true,
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
    await this.auditService.record({
      action: 'AUTO_VALIDATION',
      entity: 'Payment',
      entityId: payment.id,
      newValues: {
        gateway: 'WOMPI',
        transactionId: transaction.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: transaction.amount_in_cents / 100,
      },
      policyRef: PaymentReconnectionPolicy.POLICY_REF,
    });

    this.eventEmitter.emit(
      PaymentReconnectionPolicy.PAYMENT_VALIDATED_EVENT,
      new PaymentValidatedEvent(payment.id, invoice.id, invoice.clientId, validatedAt),
    );
    return { processed: true };
  }
}
