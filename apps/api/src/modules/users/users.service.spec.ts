import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const dbUser = {
    id: 'user-1',
    documentId: '1085123456',
    firstName: 'Germán',
    lastName: 'Cajero',
    email: 'german@unitik.com.co',
    phone: '3151234567',
    passwordHash: 'hashed',
    role: Role.CASHIER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(UsersService);
    jest.clearAllMocks();
  });

  it('creates a user with a bcrypt-hashed password and never exposes the hash', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.create.mockImplementationOnce(({ data }) =>
      Promise.resolve({ ...dbUser, ...data }),
    );

    const created = await service.create({
      documentId: '1085123456',
      firstName: 'Germán',
      lastName: 'Cajero',
      email: 'german@unitik.com.co',
      phone: '3151234567',
      password: 'Cajero123*',
      role: Role.CASHIER,
    });

    const createArgs = prismaMock.user.create.mock.calls[0][0].data;
    expect(createArgs.passwordHash).not.toBe('Cajero123*');
    expect(await bcrypt.compare('Cajero123*', createArgs.passwordHash)).toBe(true);
    expect(created).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicated email or document', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(dbUser);
    await expect(
      service.create({
        documentId: '1085123456',
        firstName: 'Otro',
        lastName: 'Usuario',
        email: 'german@unitik.com.co',
        phone: '3151234567',
        password: 'Password1*',
        role: Role.CLIENT,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('update returns previous state for auditing (old vs new values)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser);
    prismaMock.user.update.mockResolvedValueOnce({ ...dbUser, isActive: false });

    const { user, previous } = await service.update('user-1', { isActive: false });

    expect(previous.isActive).toBe(true);
    expect(user.isActive).toBe(false);
    expect(previous).not.toHaveProperty('passwordHash');
  });

  it('throws NotFound when updating a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.update('missing', { isActive: false })).rejects.toThrow(
      NotFoundException,
    );
  });
});
