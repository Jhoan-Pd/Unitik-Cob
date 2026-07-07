import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Payment, Role } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { ValidatePaymentDto } from './dto/validate-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.CASHIER, Role.CLIENT)
  @Audited({ entity: 'Payment' })
  @ApiOperation({ summary: 'Registrar un pago (queda pendiente de validación)' })
  register(@Body() dto: RegisterPaymentDto): Promise<Payment> {
    return this.paymentsService.register(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un pago' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Payment> {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id/validate')
  @Roles(Role.ADMIN, Role.CASHIER)
  @Audited({ entity: 'Payment', action: 'VALIDATION' })
  @ApiOperation({
    summary: 'Validar o rechazar un pago (dispara la reconexión encolada al aprobar)',
  })
  async validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request & { auditOldValues?: unknown },
  ): Promise<Payment> {
    const { payment, previous } = await this.paymentsService.validate(id, dto, user);
    request.auditOldValues = previous;
    return payment;
  }
}
