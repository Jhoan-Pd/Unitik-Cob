import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Invoice, InvoiceStatus, Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Read-only invoices (Iteration 3 — client portal needs).
 * Generation, interest, promises and DIAN integration arrive in Iteration 4.
 */
@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly prisma: PrismaService) {}

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
}
