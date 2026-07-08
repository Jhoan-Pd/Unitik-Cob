import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;

  const prismaMock = {
    client: { findUnique: jest.fn() },
    ticket: { count: jest.fn(), create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  const clientUser = { id: 'user-c', email: 'c@test.co', role: Role.CLIENT };
  const technician = { id: 'tech-1', email: 't@test.co', role: Role.TECHNICIAN };
  const admin = { id: 'admin-1', email: 'a@test.co', role: Role.ADMIN };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TicketsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(TicketsService);
    jest.clearAllMocks();
  });

  it('el cliente solo crea tickets para sí mismo, con número TKT-<año>-<seq>', async () => {
    prismaMock.client.findUnique.mockResolvedValueOnce({ id: 'client-9' });
    prismaMock.ticket.count.mockResolvedValueOnce(41);
    prismaMock.ticket.create.mockImplementationOnce(({ data }) => Promise.resolve(data));

    const ticket = await service.create(
      { clientId: 'otro-cliente', title: 'Sin señal', description: 'x', category: 'SUPPORT' },
      clientUser,
    );

    expect(ticket.clientId).toBe('client-9'); // ignora el clientId ajeno
    expect(ticket.ticketNumber).toBe(`TKT-${new Date().getFullYear()}-00042`);
  });

  it('el personal interno debe indicar clientId', async () => {
    await expect(
      service.create({ title: 'x', description: 'y', category: 'BILLING' }, admin),
    ).rejects.toThrow(NotFoundException);
  });

  it('el técnico solo gestiona tickets asignados a él', async () => {
    prismaMock.ticket.findUnique.mockResolvedValueOnce({
      id: 'tkt-1',
      assignedToId: 'otro-tecnico',
      status: TicketStatus.OPEN,
    });
    await expect(
      service.update('tkt-1', { status: TicketStatus.IN_PROGRESS }, technician),
    ).rejects.toThrow(ForbiddenException);
  });

  it('cerrar un ticket registra closedAt automáticamente', async () => {
    prismaMock.ticket.findUnique.mockResolvedValueOnce({
      id: 'tkt-1',
      assignedToId: technician.id,
      status: TicketStatus.RESOLVED,
    });
    prismaMock.ticket.update.mockImplementationOnce(({ data }) => Promise.resolve(data));

    const { ticket } = await service.update('tkt-1', { status: TicketStatus.CLOSED }, technician);
    expect((ticket as { closedAt?: Date }).closedAt).toBeInstanceOf(Date);
  });

  it('vista por rol: cliente ve lo suyo; técnico por defecto ve lo asignado', async () => {
    prismaMock.client.findUnique.mockResolvedValueOnce({ id: 'client-9' });
    prismaMock.ticket.findMany.mockResolvedValue([]);
    await service.findAll(clientUser, {});
    expect(prismaMock.ticket.findMany.mock.calls[0][0].where.clientId).toBe('client-9');

    await service.findAll(technician, {});
    expect(prismaMock.ticket.findMany.mock.calls[1][0].where.assignedToId).toBe('tech-1');
  });
});
