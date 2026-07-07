import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan, Prisma, ServiceType } from '@prisma/client';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  findAll(filters: { serviceType?: ServiceType; onlyActive?: boolean }): Promise<Plan[]> {
    const where: Prisma.PlanWhereInput = {};
    if (filters.serviceType) where.serviceType = filters.serviceType;
    if (filters.onlyActive) where.isActive = true;
    return this.prisma.plan.findMany({
      where,
      orderBy: [{ serviceType: 'asc' }, { speedMbps: 'asc' }],
    });
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  /** Defaults come from system_config, never hardcoded (golden rule #3). */
  async create(dto: CreatePlanDto): Promise<Plan> {
    const installationFee =
      dto.installationFee ?? (await this.systemConfig.getNumber('installation_fee_default'));
    const tvPrice =
      dto.tvPrice ??
      (dto.includesTv ? await this.systemConfig.getNumber('tv_service_price') : null);

    return this.prisma.plan.create({
      data: { ...dto, installationFee, tvPrice },
    });
  }

  /** No hard delete: plans with subscriptions are deactivated instead. */
  async update(id: string, dto: UpdatePlanDto): Promise<{ plan: Plan; previous: Plan }> {
    const previous = await this.findOne(id);
    const plan = await this.prisma.plan.update({ where: { id }, data: dto });
    return { plan, previous };
  }
}
