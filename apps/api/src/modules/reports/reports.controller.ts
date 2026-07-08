import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaymentStatus, Role, SubscriptionStatus } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const csvEscape = (value: unknown): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

/** CSV exports (Excel-friendly). PDF nativo se evalúa en Fase 4 si se requiere. */
@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('collections.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="recaudo-unitik.csv"')
  @ApiOperation({ summary: 'Reporte de recaudo: pagos validados por período' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async collections(@Query('from') from?: string, @Query('to') to?: string): Promise<string> {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.VALIDATED,
        ...(from || to
          ? {
              paidAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { invoice: { include: { client: { include: { user: true } } } } },
      orderBy: { paidAt: 'desc' },
      take: 10_000,
    });

    const header = 'fecha;factura;cliente;codigo;metodo;autoValidado;monto';
    const lines = payments.map((p) =>
      [
        p.paidAt.toISOString(),
        p.invoice.invoiceNumber,
        `${p.invoice.client.user.firstName} ${p.invoice.client.user.lastName}`,
        p.invoice.client.clientCode,
        p.paymentMethod,
        p.autoValidated ? 'SI' : 'NO',
        Number(p.amount),
      ]
        .map(csvEscape)
        .join(';'),
    );
    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    return [header, ...lines, `${csvEscape('TOTAL')};;;;;;${csvEscape(total)}`].join('\r\n');
  }

  @Get('clients-by-plan.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="clientes-por-plan-unitik.csv"')
  @ApiOperation({ summary: 'Reporte de clientes por plan (suscripciones activas)' })
  async clientsByPlan(): Promise<string> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });

    const byPlan = new Map<string, { plan: string; type: string; speed: number; price: number; count: number }>();
    for (const s of subscriptions) {
      const entry = byPlan.get(s.planId) ?? {
        plan: s.plan.name,
        type: s.plan.serviceType,
        speed: s.plan.speedMbps,
        price: Number(s.plan.monthlyPrice),
        count: 0,
      };
      entry.count += 1;
      byPlan.set(s.planId, entry);
    }

    const header = 'plan;servicio;megas;precioMensual;clientesActivos;ingresoMensualEstimado';
    const lines = [...byPlan.values()]
      .sort((a, b) => b.count - a.count)
      .map((e) =>
        [e.plan, e.type, e.speed, e.price, e.count, e.price * e.count].map(csvEscape).join(';'),
      );
    return [header, ...lines].join('\r\n');
  }
}
