import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientStatus, InvoiceStatus, PrismaClient, Role } from '@prisma/client';
import request from 'supertest';

// 64-hex key required by AES-256-GCM before the AppModule loads
process.env.DEVICE_SECRET_KEY = process.env.DEVICE_SECRET_KEY ?? 'd'.repeat(64);

import { AppModule } from '../src/app.module';
import { SuspensionCron } from '../src/modules/network/suspension.cron';

/**
 * Iteration 5 e2e: device CRUD with encrypted credentials (never returned),
 * mock ping, and the overdue → grace period → queued suspension flow.
 */
describe('Red MikroTik: dispositivos y suspensión automática (e2e)', () => {
  let app: INestApplication;
  let suspensionCron: SuspensionCron;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  let adminToken = '';
  const fixture = { userId: '', clientId: '', subscriptionId: '', deviceId: '', accessId: '' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    suspensionCron = app.get(SuspensionCron);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identifier: process.env.SEED_ADMIN_EMAIL ?? 'admin@unitik.com.co',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*',
      })
      .expect(200);
    adminToken = login.body.accessToken;

    const plan = await prisma.plan.findFirstOrThrow({ where: { serviceType: 'RADIO' } });
    const user = await prisma.user.create({
      data: {
        documentId: `77${suffix.slice(-8)}`,
        firstName: 'Moroso',
        lastName: 'Rural',
        email: `net-${suffix}@test.unitik.co`,
        phone: '3007777777',
        passwordHash: 'x',
        role: Role.CLIENT,
      },
    });
    fixture.userId = user.id;
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        clientCode: `NET-${suffix}`,
        address: 'Vereda La Esperanza',
        serviceType: 'RADIO',
        paymentModality: 'POSTPAID',
        installationDate: new Date(),
        status: ClientStatus.ACTIVE,
      },
    });
    fixture.clientId = client.id;
    const subscription = await prisma.subscription.create({
      data: { clientId: client.id, planId: plan.id, startDate: new Date() },
    });
    fixture.subscriptionId = subscription.id;
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payment.deleteMany({ where: { invoice: { clientId: fixture.clientId } } });
      await prisma.invoice.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.networkAccess.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.networkDevice.deleteMany({ where: { id: fixture.deviceId } });
      await prisma.subscription.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.client.deleteMany({ where: { id: fixture.clientId } });
      await prisma.user.deleteMany({ where: { id: fixture.userId } });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30000);

  it('ADMIN registra una RouterBoard: contraseña cifrada, jamás devuelta, auditado', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/network/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `RB-NET-${suffix}`,
        deviceType: 'ROUTERBOARD',
        ipAddress: '10.20.30.1',
        apiUsername: 'api-unitik',
        apiPassword: 'clave-super-secreta',
        location: 'Torre rural La Esperanza',
      })
      .expect(201);

    fixture.deviceId = created.body.id;
    expect(created.body).not.toHaveProperty('apiPasswordEnc');
    expect(JSON.stringify(created.body)).not.toContain('clave-super-secreta');
    expect(created.body.status).toBe('unknown');

    const stored = await prisma.networkDevice.findUniqueOrThrow({
      where: { id: fixture.deviceId },
    });
    expect(stored.apiPasswordEnc).not.toContain('clave-super-secreta');
    expect(stored.apiPasswordEnc.split('.')).toHaveLength(3); // iv.tag.ciphertext

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'NetworkDevice', action: 'CREATE', entityId: fixture.deviceId },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit?.newValues)).not.toContain('clave-super-secreta');
  });

  it('ping (mock) deja el dispositivo online', async () => {
    const ping = await request(app.getHttpServer())
      .post(`/api/network/devices/${fixture.deviceId}/ping`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(ping.body.online).toBe(true);

    const device = await request(app.getHttpServer())
      .get(`/api/network/devices/${fixture.deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(device.body.status).toBe('online');
  });

  it('mora + gracia vencida → suspensión encolada, ejecutada y auditada', async () => {
    // Fixture: acceso habilitado + factura OVERDUE vencida hace 10 días (gracia: 7)
    const access = await prisma.networkAccess.create({
      data: {
        clientId: fixture.clientId,
        deviceId: fixture.deviceId,
        pppoeUser: `net${suffix}`,
        isEnabled: true,
        lastAction: 'enabled',
      },
    });
    fixture.accessId = access.id;
    await prisma.invoice.create({
      data: {
        invoiceNumber: `FCT-NET-${suffix}`,
        clientId: fixture.clientId,
        subscriptionId: fixture.subscriptionId,
        period: '2099-02',
        issueDate: new Date(),
        dueDate: new Date(Date.now() - 10 * 86_400_000),
        subtotal: 50000,
        total: 50000,
        status: InvoiceStatus.OVERDUE,
      },
    });

    const { enqueued } = await suspensionCron.enqueueSuspensions();
    expect(enqueued).toBeGreaterThanOrEqual(1);

    // El worker procesa la suspensión (MikroTik mock)
    let suspended = false;
    for (let i = 0; i < 30 && !suspended; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const refreshed = await prisma.networkAccess.findUnique({ where: { id: access.id } });
      suspended = refreshed?.isEnabled === false && refreshed.lastAction === 'disabled';
    }
    expect(suspended).toBe(true);

    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.clientId } });
    expect(client.status).toBe(ClientStatus.SUSPENDED);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'NetworkAccess', action: 'SUSPEND', entityId: access.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.policyRef).toBe('ISO/IEC 38500 - Responsabilidad');
  }, 40000);
});
