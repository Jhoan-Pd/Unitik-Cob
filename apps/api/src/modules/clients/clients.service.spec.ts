import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientStatus, PaymentModality, Role, ServiceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientsService, STATUS_AUDIT_ACTION } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;

  const prismaMock = {
    user: { findFirst: jest.fn() },
    client: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  };

  const createDto = {
    documentId: '1085123456',
    firstName: 'Rosa',
    lastName: 'Delgado',
    email: 'rosa@correo.com',
    phone: '3151234567',
    address: 'Calle 3 # 4-21',
    serviceType: ServiceType.FIBER,
    paymentModality: PaymentModality.POSTPAID,
    installationDate: '2026-07-01',
  };

  const dbClient = {
    id: 'client-1',
    userId: 'user-1',
    clientCode: 'CLI-1085123456',
    status: ClientStatus.ACTIVE,
    user: { id: 'user-1', firstName: 'Rosa', role: Role.CLIENT },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(ClientsService);
    jest.clearAllMocks();
  });

  it('creates user CLIENT + client atomically with clientCode CLI-<cedula>', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.client.create.mockImplementationOnce(({ data }) =>
      Promise.resolve({ ...dbClient, ...data }),
    );

    const client = await service.create(createDto);

    const data = prismaMock.client.create.mock.calls[0][0].data;
    expect(data.clientCode).toBe('CLI-1085123456');
    expect(data.municipality).toBe('Cumbitara');
    expect(data.user.create.role).toBe(Role.CLIENT);
    expect(data.user.create.passwordHash).not.toBe('1085123456'); // hashed default
    expect(client.clientCode).toBe('CLI-1085123456');
  });

  it('rejects duplicated document/email', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.create(createDto)).rejects.toThrow(ConflictException);
  });

  it('maps status transitions to audit actions (SUSPEND/REACTIVATE/CUT/CANCEL)', () => {
    expect(STATUS_AUDIT_ACTION.SUSPENDED).toBe('SUSPEND');
    expect(STATUS_AUDIT_ACTION.ACTIVE).toBe('REACTIVATE');
    expect(STATUS_AUDIT_ACTION.CUT).toBe('CUT');
    expect(STATUS_AUDIT_ACTION.CANCELLED).toBe('CANCEL');
  });

  it('changeStatus returns previous state and refuses no-op transitions', async () => {
    prismaMock.client.findUnique.mockResolvedValueOnce({ ...dbClient });
    prismaMock.client.update.mockResolvedValueOnce({
      ...dbClient,
      status: ClientStatus.SUSPENDED,
    });

    const result = await service.changeStatus('client-1', {
      status: ClientStatus.SUSPENDED,
      reason: 'Mora superior a 30 días',
    });
    expect(result.previous.status).toBe(ClientStatus.ACTIVE);
    expect(result.action).toBe('SUSPEND');

    prismaMock.client.findUnique.mockResolvedValueOnce({
      ...dbClient,
      status: ClientStatus.SUSPENDED,
    });
    await expect(
      service.changeStatus('client-1', { status: ClientStatus.SUSPENDED, reason: 'x' }),
    ).rejects.toThrow(ConflictException);
  });
});
