import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionsService, SubscriptionWithPlan } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('my')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Mi plan activo (portal cliente)' })
  my(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionWithPlan | null> {
    return this.subscriptionsService.findActiveByUserId(user.id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.CASHIER)
  @ApiOperation({ summary: 'Suscripciones de un cliente' })
  @ApiQuery({ name: 'clientId', required: true })
  findByClient(@Query('clientId') clientId: string): Promise<SubscriptionWithPlan[]> {
    return this.subscriptionsService.findByClient(clientId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Audited({ entity: 'Subscription' })
  @ApiOperation({ summary: 'Asignar plan a cliente (cierra la suscripción activa anterior)' })
  create(@Body() dto: CreateSubscriptionDto): Promise<SubscriptionWithPlan> {
    return this.subscriptionsService.create(dto);
  }
}
