import { Test } from '@nestjs/testing';
import { ServiceType } from '@prisma/client';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let service: PlansService;

  const prismaMock = {
    plan: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const configMock = {
    getNumber: jest.fn((key: string) =>
      Promise.resolve(key === 'installation_fee_default' ? 50000 : 10000),
    ),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: configMock },
      ],
    }).compile();
    service = moduleRef.get(PlansService);
    jest.clearAllMocks();
  });

  it('creates a plan pulling defaults from system_config (never hardcoded)', async () => {
    prismaMock.plan.create.mockImplementationOnce(({ data }) => Promise.resolve(data));

    await service.create({
      name: 'Plan 5 Fibra',
      description: 'Fibra 200 Megas',
      serviceType: ServiceType.FIBER,
      speedMbps: 200,
      monthlyPrice: 150000,
      includesTv: true,
    });

    expect(configMock.getNumber).toHaveBeenCalledWith('installation_fee_default');
    expect(configMock.getNumber).toHaveBeenCalledWith('tv_service_price');
    const data = prismaMock.plan.create.mock.calls[0][0].data;
    expect(data.installationFee).toBe(50000);
    expect(data.tvPrice).toBe(10000);
  });

  it('update returns previous values for the audit trail', async () => {
    const plan = { id: 'plan-1', name: 'Plan 1 Fibra', monthlyPrice: 50000, isActive: true };
    prismaMock.plan.findUnique.mockResolvedValueOnce(plan);
    prismaMock.plan.update.mockResolvedValueOnce({ ...plan, monthlyPrice: 55000 });

    const { plan: updated, previous } = await service.update('plan-1', { monthlyPrice: 55000 });
    expect(previous.monthlyPrice).toBe(50000);
    expect(updated.monthlyPrice).toBe(55000);
  });
});
