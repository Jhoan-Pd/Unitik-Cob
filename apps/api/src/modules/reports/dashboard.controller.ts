import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ClientStatus,
  InvoiceStatus,
  PaymentStatus,
  Role,
  TicketStatus,
} from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardKpis {
  activeClients: number;
  suspendedClients: number;
  monthRevenue: number; // COP validados este mes
  overdueClients: number;
  overdueAmount: number;
  openTickets: number;
  devicesOnline: number;
  devicesTotal: number;
}

/** Admin dashboard KPIs (uptime de red se deriva de lastPing de dispositivos). */
@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs: clientes, ingresos del mes, morosos, tickets, red' })
  async kpis(): Promise<DashboardKpis> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const onlineSince = new Date(Date.now() - 5 * 60_000);

    const [
      activeClients,
      suspendedClients,
      monthPayments,
      overdueInvoices,
      openTickets,
      devicesTotal,
      devicesOnline,
    ] = await Promise.all([
      this.prisma.client.count({ where: { status: ClientStatus.ACTIVE } }),
      this.prisma.client.count({ where: { status: ClientStatus.SUSPENDED } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.VALIDATED, validatedAt: { gte: monthStart } },
      }),
      this.prisma.invoice.findMany({
        where: { status: InvoiceStatus.OVERDUE },
        select: { clientId: true, total: true },
      }),
      this.prisma.ticket.count({
        where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
      }),
      this.prisma.networkDevice.count({ where: { isActive: true } }),
      this.prisma.networkDevice.count({
        where: { isActive: true, lastPing: { gte: onlineSince } },
      }),
    ]);

    return {
      activeClients,
      suspendedClients,
      monthRevenue: Number(monthPayments._sum.amount ?? 0),
      overdueClients: new Set(overdueInvoices.map((i) => i.clientId)).size,
      overdueAmount: overdueInvoices.reduce((sum, i) => sum + Number(i.total), 0),
      openTickets,
      devicesOnline,
      devicesTotal,
    };
  }
}
