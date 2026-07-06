import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityPolicy } from '../governance/traceability.policy';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  const prismaMock = { auditLog: { create: jest.fn() } };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        TraceabilityPolicy,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(AuditService);
    jest.clearAllMocks();
  });

  it('persists the entry with a policyRef resolved from the entity', async () => {
    prismaMock.auditLog.create.mockResolvedValueOnce({});

    await service.record({
      userId: 'admin-1',
      action: 'UPDATE',
      entity: 'SystemConfig',
      entityId: 'interest_rate_percent',
      oldValues: { value: '2.5' },
      newValues: { value: '3.0' },
      ipAddress: '10.0.0.1',
    });

    const data = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(data.policyRef).toContain('ISO/IEC 38500');
    expect(data.oldValues).toEqual({ value: '2.5' });
  });

  it('strips sensitive keys (passwords, tokens) from stored values', async () => {
    prismaMock.auditLog.create.mockResolvedValueOnce({});

    await service.record({
      action: 'CREATE',
      entity: 'User',
      newValues: {
        email: 'nuevo@unitik.com.co',
        passwordHash: 'super-secret',
        nested: { refreshToken: 'jwt-here', phone: '3151234567' },
      },
    });

    const data = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(data.newValues.email).toBe('nuevo@unitik.com.co');
    expect(data.newValues.passwordHash).toBeUndefined();
    expect(data.newValues.nested.refreshToken).toBeUndefined();
    expect(data.newValues.nested.phone).toBe('3151234567');
  });

  it('never throws when the audit write fails (availability over failure)', async () => {
    prismaMock.auditLog.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.record({ action: 'CREATE', entity: 'Client' }),
    ).resolves.toBeUndefined();
  });
});
