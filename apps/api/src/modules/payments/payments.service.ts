import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  InvoiceStatus,
  NotificationChannel,
  Payment,
  PaymentStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaymentReconnectionPolicy } from '../governance/payment-reconnection.policy';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { ValidatePaymentDto } from './dto/validate-payment.dto';
import { PaymentValidatedEvent } from './events/payment-validated.event';

/**
 * Payment registration and validation (Policy 1 — ISO/IEC 38500
 * Performance + Conformance). Iteration 2 delivers the architectural
 * prototype of the critical flow; billing rules (interest, promises,
 * webhooks) are completed in Iteration 4.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PaymentReconnectionPolicy,
    private readonly eventEmitter: EventEmitter2,
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
      // Prototype simplification: full covering-amount logic lands in It. 4
      this.prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: InvoiceStatus.PAID },
      }),
    ]);

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
}
