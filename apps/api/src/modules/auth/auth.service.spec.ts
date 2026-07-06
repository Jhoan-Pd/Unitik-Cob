import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const prismaMock = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
  };
  const auditMock = { record: jest.fn() };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  const buildUser = async () => ({
    id: 'user-1',
    documentId: '1085123456',
    firstName: 'Admin',
    lastName: 'UNITIK',
    email: 'admin@unitik.com.co',
    phone: '3000000000',
    passwordHash: await bcrypt.hash('Admin123*', 4),
    role: Role.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
        },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback: string) => fallback },
        },
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
    jest.clearAllMocks();
  });

  it('logs in with valid credentials, audits LOGIN and returns both tokens', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(await buildUser());

    const result = await service.login('admin@unitik.com.co', 'Admin123*', meta);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('admin@unitik.com.co');
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN', entity: 'User', userId: 'user-1' }),
    );
  });

  it('rejects wrong password and audits LOGIN_FAILED', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(await buildUser());

    await expect(service.login('admin@unitik.com.co', 'incorrecta1', meta)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED' }),
    );
  });

  it('refreshes tokens for an active user with a valid refresh token', async () => {
    const user = await buildUser();
    prismaMock.user.findUnique.mockResolvedValueOnce(user);
    const refreshToken = await jwtService.signAsync(
      { sub: user.id, tokenType: 'refresh' },
      { secret: 'change-me-refresh-secret' },
    );

    const result = await service.refresh(refreshToken, meta);

    expect(result.accessToken).toBeDefined();
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TOKEN_REFRESH' }),
    );
  });

  it('rejects an access token used as refresh token', async () => {
    const accessLikeToken = await jwtService.signAsync(
      { sub: 'user-1', tokenType: 'access' },
      { secret: 'change-me-refresh-secret' },
    );
    await expect(service.refresh(accessLikeToken, meta)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects refresh for a deactivated user', async () => {
    const user = await buildUser();
    prismaMock.user.findUnique.mockResolvedValueOnce({ ...user, isActive: false });
    const refreshToken = await jwtService.signAsync(
      { sub: user.id, tokenType: 'refresh' },
      { secret: 'change-me-refresh-secret' },
    );
    await expect(service.refresh(refreshToken, meta)).rejects.toThrow(UnauthorizedException);
  });
});
