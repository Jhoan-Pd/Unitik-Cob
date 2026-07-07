import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ClientStatus, InvoiceStatus } from '@prisma/client';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NETWORK_ACTIONS_QUEUE } from '../../queues/queues.module';
import { SuspensionCron } from './suspension.cron';

describe('SuspensionCron (mora → suspensión encolada)', () => {
  let cron: SuspensionCron;

  const prismaMock = {
    invoice: { findMany: jest.fn() },
    networkAccess: { findFirst: jest.fn() },
  };
  const configMock = { getNumber: jest.fn().mockResolvedValue(7) };
  const queueMock = { add: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SuspensionCron,
        ServiceContinuityPolicy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: configMock },
        { provide: getQueueToken(NETWORK_ACTIONS_QUEUE), useValue: queueMock },
      ],
    }).compile();
    cron = moduleRef.get(SuspensionCron);
    jest.clearAllMocks();
    configMock.getNumber.mockResolvedValue(7);
  });

  it('encola suspensión para facturas OVERDUE tras el período de gracia', async () => {
    prismaMock.invoice.findMany.mockResolvedValueOnce([
      {
        id: 'inv-1',
        invoiceNumber: 'FCT-2026-06-CLI-1',
        clientId: 'client-1',
        client: { clientCode: 'CLI-1', status: ClientStatus.ACTIVE },
      },
    ]);
    prismaMock.networkAccess.findFirst.mockResolvedValueOnce({ id: 'access-1' });

    const result = await cron.enqueueSuspensions(new Date('2026-07-07T12:00:00Z'));

    expect(result.enqueued).toBe(1);
    // Grace period comes from system_config (golden rule #3)
    expect(configMock.getNumber).toHaveBeenCalledWith('grace_period_days');
    const [name, data, options] = queueMock.add.mock.calls[0];
    expect(name).toBe('suspend');
    expect(data.reason).toContain('FCT-2026-06-CLI-1');
    expect(options.jobId).toBe('suspend-client-1-2026-07-07'); // one per client/day
  });

  it('la consulta excluye PROMISE_TO_PAY (las promesas protegen de suspensión)', async () => {
    prismaMock.invoice.findMany.mockResolvedValueOnce([]);
    await cron.enqueueSuspensions();
    const where = prismaMock.invoice.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(InvoiceStatus.OVERDUE);
    expect(where.client.status).toBe(ClientStatus.ACTIVE);
  });

  it('clientes morosos sin acceso de red no encolan nada (solo warning)', async () => {
    prismaMock.invoice.findMany.mockResolvedValueOnce([
      {
        id: 'inv-2',
        invoiceNumber: 'FCT-X',
        clientId: 'client-2',
        client: { clientCode: 'CLI-2', status: ClientStatus.ACTIVE },
      },
    ]);
    prismaMock.networkAccess.findFirst.mockResolvedValueOnce(null);

    const result = await cron.enqueueSuspensions();
    expect(result.enqueued).toBe(0);
    expect(queueMock.add).not.toHaveBeenCalled();
  });
});
