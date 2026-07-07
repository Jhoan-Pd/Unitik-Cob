import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MikrotikService } from './mikrotik.service';
import { ReconnectionJobData, ReconnectionProcessor } from './reconnection.processor';

describe('ReconnectionProcessor (Policies 1 + 4)', () => {
  let processor: ReconnectionProcessor;

  const prismaMock = {
    networkAccess: { findUnique: jest.fn(), update: jest.fn() },
    client: { update: jest.fn() },
    operationalMetric: { create: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const mikrotikMock = { enableClient: jest.fn() };
  const auditMock = { record: jest.fn() };

  const jobData: ReconnectionJobData = {
    networkAccessId: 'access-1',
    clientId: 'client-1',
    paymentId: 'pay-1',
    validatedAt: new Date(Date.now() - 90_000).toISOString(), // 1.5 min ago
  };
  const job = { data: jobData, attemptsMade: 0 } as Job<ReconnectionJobData>;

  const access = {
    id: 'access-1',
    clientId: 'client-1',
    deviceId: 'device-1',
    pppoeUser: 'cliente001',
    isEnabled: false,
    lastAction: 'disabled',
    device: { id: 'device-1', name: 'RB Principal' },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReconnectionProcessor,
        ServiceContinuityPolicy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MikrotikService, useValue: mikrotikMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    processor = moduleRef.get(ReconnectionProcessor);
    jest.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('reconnects, audits RECONNECT and records the SLA metric', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce(access);
    prismaMock.operationalMetric.create.mockResolvedValueOnce({});

    await processor.process(job);

    expect(mikrotikMock.enableClient).toHaveBeenCalledWith('device-1', 'cliente001');
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECONNECT',
        entity: 'NetworkAccess',
        policyRef: 'ISO/IEC 38500 - Responsabilidad',
      }),
    );
    const metric = prismaMock.operationalMetric.create.mock.calls[0][0].data;
    expect(metric.metricType).toBe('RECONNECTION_TIME_MINUTES');
    expect(metric.value).toBeGreaterThanOrEqual(1.5);
    expect(metric.value).toBeLessThan(5); // dentro del SLA
  });

  it('audits RECONNECT_SKIPPED and does not touch MikroTik when access is missing', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce(null);

    await processor.process(job);

    expect(mikrotikMock.enableClient).not.toHaveBeenCalled();
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RECONNECT_SKIPPED' }),
    );
  });

  it('propagates MikroTik failures so BullMQ retries per continuity policy', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce(access);
    mikrotikMock.enableClient.mockRejectedValueOnce(new Error('RouterBoard caída'));

    await expect(processor.process(job)).rejects.toThrow('RouterBoard caída');
    expect(prismaMock.operationalMetric.create).not.toHaveBeenCalled();
  });
});
