import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const prismaMock = {
    client: { findUnique: jest.fn() },
    plan: { findUnique: jest.fn() },
    subscription: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const configMock = { getNumber: jest.fn().mockResolvedValue(10) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: configMock },
      ],
    }).compile();
    service = moduleRef.get(SubscriptionsService);
    jest.clearAllMocks();
    configMock.getNumber.mockResolvedValue(10);
  });

  it('closes the previous ACTIVE subscription and creates the new one in a tx', async () => {
    prismaMock.client.findUnique.mockResolvedValueOnce({ id: 'client-1' });
    prismaMock.plan.findUnique.mockResolvedValueOnce({ id: 'plan-2', isActive: true });
    const created = { id: 'sub-2', clientId: 'client-1', planId: 'plan-2', plan: {} };
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 1 }, created]);

    const subscription = await service.create({ clientId: 'client-1', planId: 'plan-2' });

    expect(subscription.id).toBe('sub-2');
    // First tx operation cancels any ACTIVE subscription of the client
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1', status: SubscriptionStatus.ACTIVE },
        data: expect.objectContaining({ status: SubscriptionStatus.CANCELLED }),
      }),
    );
    // Cut-off day comes from system_config when not provided (golden rule #3)
    expect(configMock.getNumber).toHaveBeenCalledWith('cut_off_day_end');
  });

  it('rejects assignment to an inactive plan', async () => {
    prismaMock.client.findUnique.mockResolvedValueOnce({ id: 'client-1' });
    prismaMock.plan.findUnique.mockResolvedValueOnce({ id: 'plan-x', isActive: false });
    await expect(service.create({ clientId: 'client-1', planId: 'plan-x' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
