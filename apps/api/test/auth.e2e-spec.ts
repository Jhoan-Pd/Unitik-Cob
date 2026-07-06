import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Happy path e2e (iteration 1): login → RBAC-protected access → audit trail.
 * Requires the docker compose infra (PostgreSQL on 5433, Redis) and the seed
 * (admin@unitik.com.co) to be applied.
 */
describe('Auth + RBAC + Audit (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@unitik.com.co';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects protected routes without a token (401)', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('rejects invalid credentials and audits LOGIN_FAILED', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: adminEmail, password: 'contraseña-mala' })
      .expect(401);

    const failedLogin = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN_FAILED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(failedLogin).not.toBeNull();
  });

  it('full happy path: login → list users with token → audit has LOGIN with IP', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: adminEmail, password: adminPassword })
      .expect(200);

    expect(login.body.accessToken).toBeDefined();
    expect(login.body.refreshToken).toBeDefined();
    expect(login.body.user.role).toBe('ADMIN');

    const users = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(Array.isArray(users.body)).toBe(true);
    expect(users.body.some((u: { email: string }) => u.email === adminEmail)).toBe(true);
    expect(users.body[0]).not.toHaveProperty('passwordHash');

    const loginAudit = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN', user: { email: adminEmail } },
      orderBy: { createdAt: 'desc' },
    });
    expect(loginAudit).not.toBeNull();
    expect(loginAudit?.ipAddress).toBeTruthy();
    expect(loginAudit?.policyRef).toContain('ISO/IEC 38500');
  });

  it('refresh token issues a new valid pair', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: adminEmail, password: adminPassword })
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    expect(refreshed.body.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);
  });

  it('system-config: reads seeded parameters and audits updates with old/new values', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: adminEmail, password: adminPassword })
      .expect(200);
    const token = login.body.accessToken;

    const configs = await request(app.getHttpServer())
      .get('/api/system-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(configs.body.length).toBeGreaterThanOrEqual(8);

    const current = await request(app.getHttpServer())
      .get('/api/system-config/interest_rate_percent')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Update and revert, verifying the audit trail captures the change
    await request(app.getHttpServer())
      .patch('/api/system-config/interest_rate_percent')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '9.9' })
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'SystemConfig', action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect((audit?.oldValues as { value: string }).value).toBe(current.body.value);
    expect((audit?.newValues as { value: string }).value).toBe('9.9');

    await request(app.getHttpServer())
      .patch('/api/system-config/interest_rate_percent')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: current.body.value })
      .expect(200);
  });
});
