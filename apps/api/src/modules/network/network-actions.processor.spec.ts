import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MikrotikService } from './mikrotik.service';
import { NetworkActionsProcessor } from './network-actions.processor';

describe('NetworkActionsProcessor (Políticas 1, 2 y 4)', () => {
  let processor: NetworkActionsProcessor;

  const prismaMock = {
    networkAccess: { findUnique: jest.fn(), update: jest.fn() },
    client: { update: jest.fn() },
    operationalMetric: { create: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const mikrotikMock = {
    enableClient: jest.fn(),
    disableClient: jest.fn(),
    changeUserProfile: jest.fn(),
  };
  const auditMock = { record: jest.fn() };

  const access = {
    id: 'access-1',
    clientId: 'client-1',
    deviceId: 'device-1',
    pppoeUser: 'cliente001',
    isEnabled: true,
    lastAction: 'enabled',
    device: { id: 'device-1' },
  };

  const jobOf = (name: string, data: object) => ({ name, data, attemptsMade: 0 }) as Job;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NetworkActionsProcessor,
        ServiceContinuityPolicy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MikrotikService, useValue: mikrotikMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    processor = moduleRef.get(NetworkActionsProcessor);
    jest.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('reconnect: habilita PPPoE, audita RECONNECT y registra la métrica del SLA', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce({ ...access, isEnabled: false });
    prismaMock.operationalMetric.create.mockResolvedValueOnce({});

    await processor.process(
      jobOf('reconnect', {
        networkAccessId: 'access-1',
        clientId: 'client-1',
        paymentId: 'pay-1',
        validatedAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    );

    expect(mikrotikMock.enableClient).toHaveBeenCalledWith('device-1', 'cliente001');
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RECONNECT', policyRef: 'ISO/IEC 38500 - Responsabilidad' }),
    );
    expect(prismaMock.operationalMetric.create).toHaveBeenCalled();
  });

  it('suspend: deshabilita PPPoE, suspende al cliente y audita SUSPEND con motivo', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce(access);

    await processor.process(
      jobOf('suspend', {
        networkAccessId: 'access-1',
        clientId: 'client-1',
        invoiceId: 'inv-1',
        reason: 'Mora: factura FCT-X vencida hace más de 7 días',
      }),
    );

    expect(mikrotikMock.disableClient).toHaveBeenCalledWith('device-1', 'cliente001');
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUSPEND',
        newValues: expect.objectContaining({ reason: expect.stringContaining('Mora') }),
      }),
    );
  });

  it('change-profile: cambia el perfil PPPoE y audita CHANGE_PROFILE', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce(access);
    prismaMock.networkAccess.update.mockResolvedValueOnce({});

    await processor.process(
      jobOf('change-profile', {
        networkAccessId: 'access-1',
        clientId: 'client-1',
        newProfile: 'Plan 3 Fibra',
      }),
    );

    expect(mikrotikMock.changeUserProfile).toHaveBeenCalledWith(
      'device-1',
      'cliente001',
      'Plan 3 Fibra',
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CHANGE_PROFILE' }),
    );
  });

  it('audita NETWORK_ACTION_SKIPPED cuando el acceso no existe (sin reintentos)', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce(null);
    await processor.process(
      jobOf('suspend', { networkAccessId: 'ghost', clientId: 'c', invoiceId: 'i', reason: 'x' }),
    );
    expect(mikrotikMock.disableClient).not.toHaveBeenCalled();
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NETWORK_ACTION_SKIPPED' }),
    );
  });

  it('propaga fallas de MikroTik para que BullMQ reintente (política de continuidad)', async () => {
    prismaMock.networkAccess.findUnique.mockResolvedValueOnce(access);
    mikrotikMock.disableClient.mockRejectedValueOnce(new Error('RouterBoard caída'));
    await expect(
      processor.process(
        jobOf('suspend', {
          networkAccessId: 'access-1',
          clientId: 'client-1',
          invoiceId: 'inv-1',
          reason: 'Mora',
        }),
      ),
    ).rejects.toThrow('RouterBoard caída');
  });
});
