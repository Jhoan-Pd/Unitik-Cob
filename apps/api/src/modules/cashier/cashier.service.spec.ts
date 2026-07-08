import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { InvoiceStatus, PaymentStatus, Role } from '@prisma/client';
import { PromisesService } from '../promises/promises.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CashierService } from './cashier.service';

describe('CashierService (Germán)', () => {
  let service: CashierService;

  const prismaMock = {
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    client: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const emitterMock = { emit: jest.fn() };
  const promisesMock = { markFulfilled: jest.fn() };
  const cashier = { id: 'german-1', email: 'german@unitik.com.co', role: Role.CASHIER };

  const invoice = {
    id: 'inv-1',
    invoiceNumber: 'FCT-2026-07-CLI-1',
    clientId: 'client-1',
    status: InvoiceStatus.OVERDUE,
    client: { user: { firstName: 'Rosa', lastName: 'Delgado' } },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CashierService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventEmitter2, useValue: emitterMock },
        { provide: PromisesService, useValue: promisesMock },
      ],
    }).compile();
    service = moduleRef.get(CashierService);
    jest.clearAllMocks();
  });

  it('el efectivo queda VALIDATED al instante, con recibo y evento de reconexión', async () => {
    prismaMock.invoice.findUnique.mockResolvedValueOnce(invoice);
    const payment = {
      id: 'pay-1',
      status: PaymentStatus.VALIDATED,
      validatedBy: cashier.id,
      paidAt: new Date(),
    };
    prismaMock.$transaction.mockResolvedValueOnce([payment, {}]);
    prismaMock.payment.count.mockResolvedValueOnce(3);

    const receipt = await service.receiveCash({ invoiceId: 'inv-1', amount: 61250 }, cashier);

    expect(receipt.receiptNumber).toMatch(/^REC-\d{8}-0003$/);
    expect(receipt.clientName).toBe('Rosa Delgado');
    expect(promisesMock.markFulfilled).toHaveBeenCalledWith('inv-1');
    expect(emitterMock.emit).toHaveBeenCalledWith(
      'payment.validated',
      expect.objectContaining({ clientId: 'client-1' }),
    );
  });

  it('rechaza pagar una factura ya pagada o anulada', async () => {
    prismaMock.invoice.findUnique.mockResolvedValueOnce({
      ...invoice,
      status: InvoiceStatus.PAID,
    });
    await expect(
      service.receiveCash({ invoiceId: 'inv-1', amount: 61250 }, cashier),
    ).rejects.toThrow(ConflictException);
  });

  it('el cierre de caja suma solo el efectivo del cajero autenticado en el día', async () => {
    prismaMock.payment.findMany.mockResolvedValueOnce([
      {
        amount: 50000,
        paidAt: new Date(),
        invoice: { invoiceNumber: 'FCT-1', client: { user: { firstName: 'A', lastName: 'B' } } },
      },
      {
        amount: 61250,
        paidAt: new Date(),
        invoice: { invoiceNumber: 'FCT-2', client: { user: { firstName: 'C', lastName: 'D' } } },
      },
    ]);

    const close = await service.dailyClose(cashier);

    expect(close.totalReceived).toBe(111250);
    expect(close.paymentsCount).toBe(2);
    const where = prismaMock.payment.findMany.mock.calls[0][0].where;
    expect(where.validatedBy).toBe('german-1');
    expect(where.paymentMethod).toBe('CASH');
  });
});
