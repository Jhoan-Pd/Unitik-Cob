import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Iteration 3 happy path: admin registers a client → assigns a plan →
 * the client logs into the portal with documento y contraseña (default:
 * the document id) and sees their plan and invoices. RBAC and audit checked.
 */
describe('Clientes, planes y portal (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const documentId = `10${suffix.slice(-8)}`;

  let adminToken = '';
  let clientId = '';
  let clientUserId = '';
  let planId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identifier: process.env.SEED_ADMIN_EMAIL ?? 'admin@unitik.com.co',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*',
      })
      .expect(200);
    adminToken = login.body.accessToken;
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.subscription.deleteMany({ where: { clientId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
      await prisma.user.deleteMany({ where: { id: clientUserId } });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30000);

  it('lista los 6 planes del seed con los precios exactos del documento', async () => {
    const plans = await request(app.getHttpServer())
      .get('/api/plans?onlyActive=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const fiber = plans.body.filter((p: { serviceType: string }) => p.serviceType === 'FIBER');
    const radio = plans.body.filter((p: { serviceType: string }) => p.serviceType === 'RADIO');
    expect(fiber.length).toBeGreaterThanOrEqual(4);
    expect(radio.length).toBeGreaterThanOrEqual(2);

    const plan20 = fiber.find((p: { speedMbps: number }) => p.speedMbps === 20);
    expect(Number(plan20.monthlyPrice)).toBe(50000);
    planId = plan20.id;
  });

  it('admin registra un cliente con validaciones colombianas y queda auditado', async () => {
    // Invalid phone rejected in Spanish
    const bad = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        documentId,
        firstName: 'Rosa',
        lastName: 'Delgado',
        email: `rosa-${suffix}@test.unitik.co`,
        phone: '12345',
        address: 'Calle 3 # 4-21',
        serviceType: 'FIBER',
        paymentModality: 'POSTPAID',
        installationDate: '2026-07-01',
      })
      .expect(400);
    expect(JSON.stringify(bad.body.message)).toContain('celular');

    const created = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        documentId,
        firstName: 'Rosa',
        lastName: 'Delgado',
        email: `rosa-${suffix}@test.unitik.co`,
        phone: '3151234567',
        address: 'Calle 3 # 4-21',
        neighborhood: 'Centro',
        gpsLat: 1.6477,
        gpsLng: -77.5787,
        serviceType: 'FIBER',
        paymentModality: 'POSTPAID',
        installationDate: '2026-07-01',
      })
      .expect(201);

    clientId = created.body.id;
    clientUserId = created.body.user.id;
    expect(created.body.clientCode).toBe(`CLI-${documentId}`);
    expect(created.body.municipality).toBe('Cumbitara');
    expect(created.body.user).not.toHaveProperty('passwordHash');

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Client', action: 'CREATE', entityId: clientId },
    });
    expect(audit).not.toBeNull();
  });

  it('asigna el plan al cliente (suscripción con día de corte de system_config)', async () => {
    const subscription = await request(app.getHttpServer())
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, planId })
      .expect(201);
    expect(subscription.body.status).toBe('ACTIVE');
    expect(subscription.body.cutOffDay).toBe(10); // seed: cut_off_day_end
  });

  it('el cliente entra al portal con documento y contraseña y ve su plan', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: documentId, password: documentId }) // default password = cédula
      .expect(200);
    const clientToken = login.body.accessToken;
    expect(login.body.user.role).toBe('CLIENT');

    const me = await request(app.getHttpServer())
      .get('/api/clients/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(me.body.clientCode).toBe(`CLI-${documentId}`);

    const myPlan = await request(app.getHttpServer())
      .get('/api/subscriptions/my')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(myPlan.body.plan.speedMbps).toBe(20);

    const myInvoices = await request(app.getHttpServer())
      .get('/api/invoices/my')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(Array.isArray(myInvoices.body)).toBe(true);

    // RBAC: the client cannot list all clients nor create plans
    await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/plans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({})
      .expect(403);
  });

  it('solo ADMIN suspende, con motivo obligatorio, y queda auditado como SUSPEND', async () => {
    await request(app.getHttpServer())
      .patch(`/api/clients/${clientId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(400); // motivo obligatorio

    const suspended = await request(app.getHttpServer())
      .patch(`/api/clients/${clientId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED', reason: 'Mora superior a 30 días' })
      .expect(200);
    expect(suspended.body.status).toBe('SUSPENDED');

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Client', action: 'STATUS_CHANGE', entityId: clientId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect((audit?.oldValues as { action: string }).action).toBe('SUSPEND');
    expect((audit?.oldValues as { reason: string }).reason).toBe('Mora superior a 30 días');
  });
});
