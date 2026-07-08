import { Injectable } from '@nestjs/common';
import { MetricType, Phase, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ExperimentalMetrics {
  phase: Phase;
  from?: string;
  to?: string;
  reconnectionTimeMinutesAvg: number | null;
  adminReworkCount: number;
  complaintCount: number;
  traceabilityPercent: number | null;
  samples: { reconnections: number };
}

/**
 * Experimental metrics for the thesis quantitative validation (Phase 4).
 * BASELINE values are captured manually (pre-intervention measurements
 * stored as OperationalMetric rows); POST_INTERVENTION values are computed
 * live from system data plus the automatic reconnection samples.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async experimental(phase: Phase, from?: Date, to?: Date): Promise<ExperimentalMetrics> {
    const range =
      from || to
        ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
        : undefined;

    if (phase === Phase.BASELINE) return this.fromStoredMetrics(phase, range, from, to);

    const metricWhere: Prisma.OperationalMetricWhereInput = {
      phase,
      metricType: MetricType.RECONNECTION_TIME_MINUTES,
      ...(range ? { measuredAt: range } : {}),
    };

    const [reconnection, rejectedPayments, complaints, traceability] = await Promise.all([
      this.prisma.operationalMetric.aggregate({
        _avg: { value: true },
        _count: true,
        where: metricWhere,
      }),
      // Rework: every REJECTED receipt forces a second validation round
      this.prisma.payment.count({
        where: { status: PaymentStatus.REJECTED, ...(range ? { createdAt: range } : {}) },
      }),
      this.prisma.ticket.count({
        where: {
          category: { in: ['BILLING', 'RECONNECTION_COMPLAINT'] },
          ...(range ? { createdAt: range } : {}),
        },
      }),
      this.computeTraceability(range),
    ]);

    return {
      phase,
      from: from?.toISOString(),
      to: to?.toISOString(),
      reconnectionTimeMinutesAvg:
        reconnection._avg.value === null ? null : Math.round(reconnection._avg.value * 100) / 100,
      adminReworkCount: rejectedPayments,
      complaintCount: complaints,
      traceabilityPercent: traceability,
      samples: { reconnections: reconnection._count },
    };
  }

  /** BASELINE: aggregate only what was measured manually pre-intervention. */
  private async fromStoredMetrics(
    phase: Phase,
    range: Prisma.DateTimeFilter | undefined,
    from?: Date,
    to?: Date,
  ): Promise<ExperimentalMetrics> {
    const aggregate = (metricType: MetricType) =>
      this.prisma.operationalMetric.aggregate({
        _avg: { value: true },
        _sum: { value: true },
        _count: true,
        where: { phase, metricType, ...(range ? { measuredAt: range } : {}) },
      });

    const [reconnection, rework, complaints, traceability] = await Promise.all([
      aggregate(MetricType.RECONNECTION_TIME_MINUTES),
      aggregate(MetricType.ADMIN_REWORK_COUNT),
      aggregate(MetricType.COMPLAINT_COUNT),
      aggregate(MetricType.TRACEABILITY_PERCENT),
    ]);

    return {
      phase,
      from: from?.toISOString(),
      to: to?.toISOString(),
      reconnectionTimeMinutesAvg:
        reconnection._avg.value === null ? null : Math.round(reconnection._avg.value * 100) / 100,
      adminReworkCount: Number(rework._sum.value ?? 0),
      complaintCount: Number(complaints._sum.value ?? 0),
      traceabilityPercent:
        traceability._avg.value === null ? null : Math.round(traceability._avg.value * 100) / 100,
      samples: { reconnections: reconnection._count },
    };
  }

  /**
   * Traceability % = audited CREATE records for critical entities vs rows
   * actually created in the period (Client, Invoice, Payment, Ticket).
   */
  private async computeTraceability(
    range: Prisma.DateTimeFilter | undefined,
  ): Promise<number | null> {
    const createdAt = range ? { createdAt: range } : {};
    const [clients, invoices, payments, tickets, audited] = await Promise.all([
      this.prisma.client.count({ where: createdAt }),
      this.prisma.invoice.count({ where: createdAt }),
      this.prisma.payment.count({ where: createdAt }),
      this.prisma.ticket.count({ where: createdAt }),
      this.prisma.auditLog.count({
        where: {
          action: { in: ['CREATE', 'AUTO_VALIDATION', 'CASH_RECEIVED'] },
          entity: { in: ['Client', 'Invoice', 'Payment', 'Ticket'] },
          ...createdAt,
        },
      }),
    ]);

    const totalCreated = clients + invoices + payments + tickets;
    if (totalCreated === 0) return null;
    return Math.min(100, Math.round((audited / totalCreated) * 10_000) / 100);
  }
}
