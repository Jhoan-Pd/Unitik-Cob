import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from './system-config.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;

  const prismaMock = {
    systemConfig: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  const interestConfig = {
    key: 'interest_rate_percent',
    value: '2.5',
    description: 'Porcentaje de interés por mora',
    updatedBy: null,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SystemConfigService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(SystemConfigService);
    jest.clearAllMocks();
  });

  it('reads a numeric parameter (golden rule #3: nothing hardcoded)', async () => {
    prismaMock.systemConfig.findUnique.mockResolvedValueOnce(interestConfig);
    await expect(service.getNumber('interest_rate_percent')).resolves.toBe(2.5);
  });

  it('rejects unknown keys instead of silently creating them', async () => {
    prismaMock.systemConfig.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('typo_key')).rejects.toThrow(NotFoundException);
  });

  it('update returns previous value for the audit trail', async () => {
    prismaMock.systemConfig.findUnique.mockResolvedValueOnce(interestConfig);
    prismaMock.systemConfig.update.mockResolvedValueOnce({
      ...interestConfig,
      value: '3.0',
      updatedBy: 'admin-1',
    });

    const { config, previous } = await service.update('interest_rate_percent', '3.0', 'admin-1');

    expect(previous.value).toBe('2.5');
    expect(config.value).toBe('3.0');
    expect(config.updatedBy).toBe('admin-1');
  });
});
