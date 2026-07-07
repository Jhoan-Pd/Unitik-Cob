import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Invoice, InvoiceStatus, Role } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService, PortfolioSummary } from './billing.service';
import { ApplyDiscountDto } from './dto/apply-discount.dto';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  @Get('my')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Mis facturas con estado y fecha límite (portal cliente)' })
  async my(@CurrentUser() user: AuthenticatedUser): Promise<Invoice[]> {
    const client = await this.prisma.client.findUnique({ where: { userId: user.id } });
    if (!client) throw new NotFoundException('El usuario no tiene un cliente asociado');
    return this.prisma.invoice.findMany({
      where: { clientId: client.id },
      orderBy: { issueDate: 'desc' },
    });
  }

  @Get('portfolio')
  @Roles(Role.ADMIN, Role.CASHIER)
  @ApiOperation({ summary: 'Cartera y morosidad (totales y ranking de morosos)' })
  portfolio(): Promise<PortfolioSummary> {
    return this.billingService.portfolio();
  }

  @Get()
  @Roles(Role.ADMIN, Role.CASHIER)
  @ApiOperation({ summary: 'Facturas por cliente y estado' })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'status', enum: InvoiceStatus, required: false })
  findAll(
    @Query('clientId') clientId?: string,
    @Query('status') status?: InvoiceStatus,
  ): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { ...(clientId ? { clientId } : {}), ...(status ? { status } : {}) },
      orderBy: { issueDate: 'desc' },
      take: 200,
    });
  }

  @Post('generate')
  @Roles(Role.ADMIN)
  @Audited({ entity: 'Invoice', action: 'GENERATE_MONTHLY' })
  @ApiOperation({
    summary: 'Generar facturación del período (el cron del día 1 lo hace automático)',
  })
  @ApiQuery({ name: 'period', required: false, description: 'YYYY-MM; por defecto el actual' })
  generate(@Query('period') period?: string): Promise<{ created: number }> {
    return this.billingService.generateMonthlyInvoices(period);
  }

  @Patch(':id/discount')
  @Roles(Role.ADMIN)
  @Audited({ entity: 'Invoice', action: 'DISCOUNT' })
  @ApiOperation({ summary: 'Aprobar descuento con motivo (solo ADMIN, auditado)' })
  async discount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyDiscountDto,
    @Req() request: Request & { auditOldValues?: unknown },
  ): Promise<Invoice> {
    const { invoice, previous } = await this.billingService.applyDiscount(
      id,
      dto.amount,
      dto.reason,
    );
    request.auditOldValues = {
      total: Number(previous.total),
      discount: Number(previous.discount),
      reason: dto.reason,
    };
    return invoice;
  }
}
