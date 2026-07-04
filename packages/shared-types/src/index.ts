// Shared enums and types mirroring the Prisma domain model.
// Keep in sync with apps/api/prisma/schema.prisma.

export type Role = 'ADMIN' | 'TECHNICIAN' | 'CASHIER' | 'CLIENT';

export type ServiceType = 'FIBER' | 'RADIO';

export type PaymentModality = 'PREPAID' | 'POSTPAID';

export type ClientStatus = 'ACTIVE' | 'SUSPENDED' | 'CUT' | 'CANCELLED';

export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'GRACE_PERIOD';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'PROMISE_TO_PAY';

export type PaymentMethod = 'CASH' | 'NEQUI' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY' | 'DAVIPLATA';

export type PaymentStatus = 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED' | 'REFUNDED';

export type DeviceType = 'ROUTERBOARD' | 'OLT' | 'AP' | 'SWITCH' | 'OTHER';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP';

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ';

export type MetricType =
  | 'RECONNECTION_TIME_MINUTES'
  | 'ADMIN_REWORK_COUNT'
  | 'COMPLAINT_COUNT'
  | 'TRACEABILITY_PERCENT';

export type ExperimentPhase = 'BASELINE' | 'POST_INTERVENTION';

/** Formats an amount as Colombian pesos: $ 1.234.567 (no decimals). */
export function formatCop(amount: number): string {
  return `$ ${Math.round(amount).toLocaleString('es-CO')}`;
}
