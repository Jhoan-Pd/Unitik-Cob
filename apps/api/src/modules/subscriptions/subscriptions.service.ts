import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Plan, Subscription, SubscriptionStatus } from '@prisma/client';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionChangedEvent } from './events/subscription-changed.event';

export type SubscriptionWithPlan = Subscription & { plan: Plan };

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Assigns a plan to a client. If an ACTIVE subscription exists it is closed
   * (endDate = now) so the client always has at most one active subscription.
   * The PPPoE profile change on the RouterBoard arrives in Iteration 5.
   */
  async create(dto: CreateSubscriptionDto): Promise<SubscriptionWithPlan> {
    const [client, plan] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: dto.clientId } }),
      this.prisma.plan.findUnique({ where: { id: dto.planId } }),
    ]);
    if (!client) throw new NotFoundException('Cliente no encontrado');
    if (!plan || !plan.isActive) throw new NotFoundException('Plan no encontrado o inactivo');

    const cutOffDay =
      dto.cutOffDay ?? (await this.systemConfig.getNumber('cut_off_day_end'));

    const [, subscription] = await this.prisma.$transaction([
      this.prisma.subscription.updateMany({
        where: { clientId: dto.clientId, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED, endDate: new Date() },
      }),
      this.prisma.subscription.create({
        data: {
          clientId: dto.clientId,
          planId: dto.planId,
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          cutOffDay,
        },
        include: { plan: true },
      }),
    ]);

    // Plan change → PPPoE profile change on the RouterBoard (queued, It. 5)
    this.eventEmitter.emit(
      SubscriptionChangedEvent.EVENT_NAME,
      new SubscriptionChangedEvent(dto.clientId, subscription.id, subscription.plan.name),
    );
    return subscription;
  }

  findByClient(clientId: string): Promise<SubscriptionWithPlan[]> {
    return this.prisma.subscription.findMany({
      where: { clientId },
      include: { plan: true },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Active subscription for the client portal ("mi plan"). */
  async findActiveByUserId(userId: string): Promise<SubscriptionWithPlan | null> {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('El usuario no tiene un cliente asociado');
    return this.prisma.subscription.findFirst({
      where: { clientId: client.id, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });
  }
}
