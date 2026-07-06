import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthResult, JwtPayload, RefreshPayload, TokenPair } from './auth.types';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /** Login with email or documentId. Every attempt outcome is audited (LOGIN). */
  async login(identifier: string, password: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { documentId: identifier }], isActive: true },
    });

    const passwordOk = user !== null && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !passwordOk) {
      await this.auditService.record({
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id,
        newValues: { identifier },
        ...meta,
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    await this.auditService.record({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ...meta,
    });

    return { ...(await this.issueTokens(user)), user: this.publicUser(user) };
  }

  /** Exchanges a valid refresh token for a new token pair. */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthResult> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o vencido');
    }
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Refresh token inválido o vencido');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario inactivo o inexistente');
    }

    await this.auditService.record({
      userId: user.id,
      action: 'TOKEN_REFRESH',
      entity: 'User',
      entityId: user.id,
      ...meta,
    });

    return { ...(await this.issueTokens(user)), user: this.publicUser(user) };
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const accessPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const refreshPayload: RefreshPayload = { sub: user.id, tokenType: 'refresh' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret(),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private refreshSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET', 'change-me-refresh-secret');
  }

  private publicUser(user: User): AuthResult['user'] {
    return {
      id: user.id,
      documentId: user.documentId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };
  }
}
