import { Injectable } from '@nestjs/common';
import { PaymentMethod, Role } from '@prisma/client';

/**
 * Policy 1 — Payment management and reconnection.
 * ISO/IEC 38500 principles: Performance + Conformance.
 *
 * Rules (from the governance policy document):
 * - Nequi/transfer payments always start in PENDING_VALIDATION.
 * - Gateway webhook payments are auto-validated (autoValidated = true).
 * - Manual validation requires ADMIN or CASHIER, an uploaded proof,
 *   and recorded validatedBy/validatedAt.
 * - Once VALIDATED, a PaymentValidatedEvent triggers reconnection via BullMQ.
 * - Reconnection SLA: < 5 minutes from validation (experimental indicator).
 */
@Injectable()
export class PaymentReconnectionPolicy {
  static readonly POLICY_REF = 'ISO/IEC 38500 - Desempeño/Conformidad';

  /** Roles allowed to manually validate or reject a payment. */
  private readonly validatorRoles: Role[] = [Role.ADMIN, Role.CASHIER];

  canValidateManually(role: Role): boolean {
    return this.validatorRoles.includes(role);
  }

  /** Payments arriving through the official gateway webhook are auto-validated. */
  isAutoValidated(method: PaymentMethod): boolean {
    return method === PaymentMethod.ONLINE_GATEWAY;
  }

  /** Methods that require a proof of payment for manual validation. */
  requiresProof(method: PaymentMethod): boolean {
    return method === PaymentMethod.NEQUI || method === PaymentMethod.BANK_TRANSFER;
  }

  /** Reconnection SLA in minutes (experimental indicator, Phase 4). */
  reconnectionSlaMinutes(): number {
    return 5;
  }

  /** Name of the domain event emitted when a payment becomes VALIDATED. */
  static readonly PAYMENT_VALIDATED_EVENT = 'payment.validated';
}
