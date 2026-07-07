import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaymentPromise, Role } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePromiseDto } from './dto/create-promise.dto';
import { PromisesService } from './promises.service';

@ApiTags('payment-promises')
@ApiBearerAuth()
@Controller('payment-promises')
export class PromisesController {
  constructor(private readonly promisesService: PromisesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @Audited({ entity: 'Invoice', action: 'PROMISE_CREATED' })
  @ApiOperation({ summary: 'Registrar promesa de pago (7 o 15 días, solo ADMIN)' })
  create(
    @Body() dto: CreatePromiseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentPromise> {
    return this.promisesService.create(dto.invoiceId, dto.daysExtension, user.id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.CASHIER)
  @ApiOperation({ summary: 'Promesas de pago de un cliente (seguimiento)' })
  @ApiQuery({ name: 'clientId', required: true })
  findByClient(@Query('clientId') clientId: string): Promise<PaymentPromise[]> {
    return this.promisesService.findByClient(clientId);
  }

  /** Daily 04:00 America/Bogota: broken promises go back to OVERDUE. */
  @Cron('0 4 * * *', { timeZone: 'America/Bogota' })
  expireBroken(): Promise<{ expired: number }> {
    return this.promisesService.expireBrokenPromises();
  }
}
