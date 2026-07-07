/** Emitted when a payment transitions to VALIDATED (Policy 1). */
export class PaymentValidatedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly invoiceId: string,
    public readonly clientId: string,
    public readonly validatedAt: Date,
  ) {}
}
