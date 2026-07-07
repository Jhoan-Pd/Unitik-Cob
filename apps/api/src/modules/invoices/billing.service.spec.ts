import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ServiceContinuityPolicy } from '../governance/service-continuity.policy';
import { SystemConfigService } from '../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ELECTRONIC_INVOICE_QUEUE } from '../../queues/queues.module';
import { BillingService } from './billing.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('BillingService', () => {
  let service: BillingService;

  const prismaMock = {
    subscription: { findMany: jest.fn() },
    invoice: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const configMock = {
    getNumber: jest.fn((key: string) => {
      const values: Record<string, number> = {
        interest_rate_percent: 2.5,
        double_payment_after_days: 30,
      };
      return Promise.resolve(values[key]);
    }),
  };
  const auditMock = { record: jest.fn() };
  const queueMock = { add: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingService,
        ServiceContinuityPolicy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: configMock },
        { provide: AuditService, useValue: auditMock },
        { provide: getQueueToken(ELECTRONIC_INVOICE_QUEUE), useValue: queueMock },
      ],
    }).compile();
    service = moduleRef.get(BillingService);
    jest.clearAllMocks();
  });

  it('generates invoices per active subscription, idempotent, and queues DIAN emission', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        clientId: 'client-1',
        cutOffDay: 10,
        plan: { monthlyPrice: 60000, includesTv: true, tvPrice: 10000 },
        client: { clientCode: 'CLI-111' },
      },
      {
        id: 'sub-2',
        clientId: 'client-2',
        cutOffDay: 5,
        plan: { monthlyPrice: 50000, includesTv: false, tvPrice: null },
        client: { clientCode: 'CLI-222' },
      },
    ]);
    // First invoice already exists (idempotency), second is created
    prismaMock.invoice.findUnique
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);
    prismaMock.invoice.create.mockImplementationOnce(({ data }) =>
      Promise.resolve({ id: 'inv-new', ...data }),
    );

    const result = await service.generateMonthlyInvoices('2026-07');

    expect(result.created).toBe(1);
    const created = prismaMock.invoice.create.mock.calls[0][0].data;
    expect(created.invoiceNumber).toBe('FCT-2026-07-CLI-222');
    expect(created.subtotal).toBe(50000); // no TV
    expect(queueMock.add).toHaveBeenCalledWith(
      'emit',
      { invoiceId: 'inv-new' },
      expect.objectContaining({ jobId: 'dian-inv-new' }),
    );
  });

  it('TV add-on is included in the subtotal when the plan has TV', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        clientId: 'client-1',
        cutOffDay: 10,
        plan: { monthlyPrice: 60000, includesTv: true, tvPrice: 10000 },
        client: { clientCode: 'CLI-111' },
      },
    ]);
    prismaMock.invoice.findUnique.mockResolvedValueOnce(null);
    prismaMock.invoice.create.mockImplementationOnce(({ data }) =>
      Promise.resolve({ id: 'inv-tv', ...data }),
    );

    await service.generateMonthlyInvoices('2026-07');
    expect(prismaMock.invoice.create.mock.calls[0][0].data.subtotal).toBe(70000);
  });

  it('marks overdue with one-time interest from system_config (2.5%)', async () => {
    const pending = {
      id: 'inv-1',
      status: InvoiceStatus.PENDING,
      subtotal: 60000,
      discount: 0,
      interest: 0,
      total: 60000,
      dueDate: new Date('2026-06-10'),
    };
    prismaMock.invoice.findMany
      .mockResolvedValueOnce([pending]) // to mark
      .mockResolvedValueOnce([]); // none beyond double threshold
    prismaMock.invoice.update.mockImplementationOnce(({ data }) =>
      Promise.resolve({ ...pending, ...data }),
    );

    const result = await service.applyOverdueRules(new Date('2026-07-06'));

    expect(result.marked).toBe(1);
    const update = prismaMock.invoice.update.mock.calls[0][0].data;
    expect(update.interest).toBe(1500); // 60000 * 2.5%
    expect(update.total).toBe(61500);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MARK_OVERDUE' }),
    );
  });

  it('applies the double monthly fee once after the configured threshold', async () => {
    const overdue = {
      id: 'inv-2',
      status: InvoiceStatus.OVERDUE,
      subtotal: 60000,
      discount: 0,
      interest: 1500,
      total: 61500,
      dueDate: new Date('2026-05-10'), // > 30 days ago
    };
    prismaMock.invoice.findMany
      .mockResolvedValueOnce([]) // none pending
      .mockResolvedValueOnce([overdue]);
    prismaMock.invoice.update.mockImplementationOnce(({ data }) =>
      Promise.resolve({ ...overdue, ...data }),
    );

    const result = await service.applyOverdueRules(new Date('2026-07-06'));

    expect(result.doubled).toBe(1);
    expect(prismaMock.invoice.update.mock.calls[0][0].data.total).toBe(121500);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DOUBLE_BILLING' }),
    );

    // Second run: already doubled → nothing happens
    jest.clearAllMocks();
    prismaMock.invoice.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...overdue, total: 121500 }]);
    const secondRun = await service.applyOverdueRules(new Date('2026-07-07'));
    expect(secondRun.doubled).toBe(0);
  });

  it('discount cannot exceed the invoice total nor touch paid invoices', async () => {
    prismaMock.invoice.findUnique.mockResolvedValueOnce({
      id: 'inv-3',
      status: InvoiceStatus.PAID,
      subtotal: 60000,
      interest: 0,
      discount: 0,
      total: 60000,
    });
    await expect(service.applyDiscount('inv-3', 10000, 'motivo')).rejects.toThrow(
      ConflictException,
    );

    prismaMock.invoice.findUnique.mockResolvedValueOnce({
      id: 'inv-4',
      status: InvoiceStatus.PENDING,
      subtotal: 60000,
      interest: 0,
      discount: 0,
      total: 60000,
    });
    await expect(service.applyDiscount('inv-4', 70000, 'motivo')).rejects.toThrow(
      ConflictException,
    );
  });
});
