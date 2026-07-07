import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { InvoiceStatus, PaymentMethod, PaymentStatus, Role } from '@prisma/client';
import { PaymentReconnectionPolicy } from '../governance/payment-reconnection.policy';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService (Policy 1 prototype)', () => {
  let service: PaymentsService;
  const emitterMock = { emit: jest.fn() };
  const prismaMock = {
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const admin = { id: 'admin-1', email: 'admin@unitik.com.co', role: Role.ADMIN };
  const technician = { id: 'tech-1', email: 'tech@unitik.com.co', role: Role.TECHNICIAN };

  const pendingPayment = {
    id: 'pay-1',
    invoiceId: 'inv-1',
    amount: 60000,
    paymentMethod: PaymentMethod.NEQUI,
    reference: 'NQ-123',
    proofUrl: 'https://files.unitik.co/proof.jpg',
    validatedBy: null,
    validatedAt: null,
    status: PaymentStatus.PENDING_VALIDATION,
    autoValidated: false,
    paidAt: new Date(),
    createdAt: new Date(),
    invoice: { id: 'inv-1', clientId: 'client-1', status: InvoiceStatus.PENDING },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        PaymentReconnectionPolicy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventEmitter2, useValue: emitterMock },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
    jest.clearAllMocks();
  });

  it('registers Nequi payments as PENDING_VALIDATION (never auto-approved)', async () => {
    prismaMock.invoice.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      status: InvoiceStatus.PENDING,
    });
    prismaMock.payment.create.mockImplementationOnce(({ data }) => Promise.resolve(data));

    const payment = await service.register({
      invoiceId: 'inv-1',
      amount: 60000,
      paymentMethod: PaymentMethod.NEQUI,
      reference: 'NQ-123',
    });

    expect(payment.status).toBe(PaymentStatus.PENDING_VALIDATION);
  });

  it('forbids validation by roles other than ADMIN/CASHIER', async () => {
    await expect(
      service.validate('pay-1', { approve: true }, technician),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects approving Nequi/transfer without an attached proof', async () => {
    prismaMock.payment.findUnique.mockResolvedValueOnce({ ...pendingPayment, proofUrl: null });
    await expect(service.validate('pay-1', { approve: true }, admin)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses double processing of an already validated payment', async () => {
    prismaMock.payment.findUnique.mockResolvedValueOnce({
      ...pendingPayment,
      status: PaymentStatus.VALIDATED,
    });
    await expect(service.validate('pay-1', { approve: true }, admin)).rejects.toThrow(
      ConflictException,
    );
  });

  it('approval sets VALIDATED with validator info and emits payment.validated', async () => {
    prismaMock.payment.findUnique.mockResolvedValueOnce(pendingPayment);
    const validated = {
      ...pendingPayment,
      status: PaymentStatus.VALIDATED,
      validatedBy: admin.id,
    };
    prismaMock.$transaction.mockResolvedValueOnce([validated, {}]);

    const result = await service.validate('pay-1', { approve: true }, admin);

    expect(result.payment.status).toBe(PaymentStatus.VALIDATED);
    expect(result.previous.status).toBe(PaymentStatus.PENDING_VALIDATION);
    expect(emitterMock.emit).toHaveBeenCalledWith(
      PaymentReconnectionPolicy.PAYMENT_VALIDATED_EVENT,
      expect.objectContaining({ paymentId: 'pay-1', clientId: 'client-1' }),
    );
  });

  it('rejection stores REJECTED, notifies the client and never emits the event', async () => {
    prismaMock.payment.findUnique.mockResolvedValueOnce(pendingPayment);
    const rejected = { ...pendingPayment, status: PaymentStatus.REJECTED };
    prismaMock.$transaction.mockImplementationOnce((ops: unknown[]) =>
      Promise.resolve([rejected, {}].slice(0, ops.length)),
    );

    const result = await service.validate(
      'pay-1',
      { approve: false, reason: 'Comprobante ilegible' },
      admin,
    );

    expect(result.payment.status).toBe(PaymentStatus.REJECTED);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'PAYMENT_REJECTED' }),
      }),
    );
    expect(emitterMock.emit).not.toHaveBeenCalled();
  });
});
