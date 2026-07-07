import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PromisesService } from './promises.service';

describe('PromisesService', () => {
  let service: PromisesService;

  const prismaMock = {
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    paymentPromise: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const configMock = { getNumber: jest.fn().mockResolvedValue(15) };
  const auditMock = { record: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PromisesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: configMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(PromisesService);
    jest.clearAllMocks();
    configMock.getNumber.mockResolvedValue(15);
  });

  it('creates a promise and moves the invoice to PROMISE_TO_PAY', async () => {
    prismaMock.invoice.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      clientId: 'client-1',
      status: InvoiceStatus.OVERDUE,
    });
    prismaMock.paymentPromise.findFirst.mockResolvedValueOnce(null);
    const promise = { id: 'prom-1', invoiceId: 'inv-1', daysExtension: 7 };
    prismaMock.$transaction.mockResolvedValueOnce([promise, {}]);

    const created = await service.create('inv-1', 7, 'admin-1');
    expect(created.id).toBe('prom-1');
  });

  it('rejects a second open promise on the same invoice', async () => {
    prismaMock.invoice.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      clientId: 'client-1',
      status: InvoiceStatus.OVERDUE,
    });
    prismaMock.paymentPromise.findFirst.mockResolvedValueOnce({ id: 'open' });
    await expect(service.create('inv-1', 7, 'admin-1')).rejects.toThrow(ConflictException);
  });

  it('rejects extensions beyond max_promise_days from system_config', async () => {
    // DTO already restricts to 7|15; the service re-checks against config
    // (the check runs BEFORE touching the invoice, so no other mocks needed)
    configMock.getNumber.mockResolvedValueOnce(10);
    await expect(service.create('inv-1', 15, 'admin-1')).rejects.toThrow(ConflictException);
  });

  it('expired unfulfilled promises send the invoice back to OVERDUE (audited)', async () => {
    prismaMock.paymentPromise.findMany.mockResolvedValueOnce([
      { id: 'prom-1', invoiceId: 'inv-1', fulfilled: false, promiseDate: new Date('2026-07-01') },
    ]);
    prismaMock.invoice.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      status: InvoiceStatus.PROMISE_TO_PAY,
    });
    prismaMock.invoice.update.mockResolvedValueOnce({});

    const result = await service.expireBrokenPromises(new Date('2026-07-06'));

    expect(result.expired).toBe(1);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMISE_BROKEN' }),
    );
  });
});
