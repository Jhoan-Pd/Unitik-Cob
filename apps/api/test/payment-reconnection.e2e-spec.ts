import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ClientStatus,
  InvoiceStatus,
  PaymentStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * ARCHITECTURAL PROTOTYPE (OpenUP Elaboration, iteration 2).
 * Proves the critical end-to-end flow with real BullMQ + Redis and a mocked
 * RouterBoard: payment registered → manually validated → event → queued job
 * → reconnection executed → audit trail + experimental metric recorded.
 */
describe('Prototipo: pago validado → reconexión encolada (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const fixture = {
    userId: '',
    clientId: '',
    subscriptionId: '',
    invoiceId: '',
    deviceId: '',
    networkAccessId: '',
    paymentId: '',
  };

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@unitik.com.co';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // --- Fixture: suspended client with pending invoice and disabled access ---
    const plan = await prisma.plan.findFirstOrThrow({ where: { serviceType: 'FIBER' } });
    const user = await prisma.user.create({
      data: {
        documentId: `99${suffix.slice(-8)}`,
        firstName: 'Cliente',
        lastName: 'Prototipo',
        email: `proto-${suffix}@test.unitik.co`,
        phone: '3009999999',
        passwordHash: 'x',
        role: Role.CLIENT,
      },
    });
    fixture.userId = user.id;

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        clientCode: `PROTO-${suffix}`,
        address: 'Vereda El Placer',
        serviceType: 'FIBER',
        paymentModality: 'POSTPAID',
        installationDate: new Date(),
        status: ClientStatus.SUSPENDED,
      },
    });
    fixture.clientId = client.id;

    const subscription = await prisma.subscription.create({
      data: { clientId: client.id, planId: plan.id, startDate: new Date() },
    });
    fixture.subscriptionId = subscription.id;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `FCT-PROTO-${suffix}`,
        clientId: client.id,
        subscriptionId: subscription.id,
        period: '2026-07',
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: 60000,
        total: 60000,
        status: InvoiceStatus.OVERDUE,
      },
    });
    fixture.invoiceId = invoice.id;

    const device = await prisma.networkDevice.create({
      data: {
        name: `RB-PROTO-${suffix}`,
        deviceType: 'ROUTERBOARD',
        ipAddress: '10.10.10.1',
        apiUsername: 'api',
        apiPasswordEnc: 'mock-encrypted',
        location: 'Cumbitara centro',
      },
    });
    fixture.deviceId = device.id;

    const access = await prisma.networkAccess.create({
      data: {
        clientId: client.id,
        deviceId: device.id,
        pppoeUser: `proto${suffix}`,
        isEnabled: false,
        lastAction: 'disabled',
        lastActionAt: new Date(),
      },
    });
    fixture.networkAccessId = access.id;
  }, 30000);

  afterAll(async () => {
    // Cleanup fixture (audit/metric rows are append-only evidence: they stay)
    try {
      await prisma.payment.deleteMany({ where: { invoiceId: fixture.invoiceId } });
      await prisma.networkAccess.deleteMany({ where: { id: fixture.networkAccessId } });
      await prisma.networkDevice.deleteMany({ where: { id: fixture.deviceId } });
      await prisma.invoice.deleteMany({ where: { id: fixture.invoiceId } });
      await prisma.subscription.deleteMany({ where: { id: fixture.subscriptionId } });
      await prisma.notification.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.client.deleteMany({ where: { id: fixture.clientId } });
      await prisma.user.deleteMany({ where: { id: fixture.userId } });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30000);

  it('recorre el flujo completo y cumple el SLA de reconexión (< 5 min)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: adminEmail, password: adminPassword })
      .expect(200);
    const token = login.body.accessToken;

    // 1. Register a Nequi payment with proof → PENDING_VALIDATION
    const registered = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceId: fixture.invoiceId,
        amount: 60000,
        paymentMethod: 'NEQUI',
        reference: `NQ-${suffix}`,
        proofUrl: 'https://files.unitik.co/comprobante.jpg',
      })
      .expect(201);
    fixture.paymentId = registered.body.id;
    expect(registered.body.status).toBe(PaymentStatus.PENDING_VALIDATION);

    // 2. Admin validates the payment → VALIDATED + event emitted
    const validated = await request(app.getHttpServer())
      .patch(`/api/payments/${fixture.paymentId}/validate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approve: true })
      .expect(200);
    expect(validated.body.status).toBe(PaymentStatus.VALIDATED);
    expect(validated.body.validatedBy).toBeTruthy();

    // 3. The queued reconnection executes (mock RouterBoard) — poll until done
    let reconnected = false;
    for (let attempt = 0; attempt < 30 && !reconnected; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const access = await prisma.networkAccess.findUnique({
        where: { id: fixture.networkAccessId },
      });
      reconnected = access?.lastAction === 'reconnected' && access.isEnabled;
    }
    expect(reconnected).toBe(true);

    // 4. Client is ACTIVE again and the invoice is PAID
    const client = await prisma.client.findUnique({ where: { id: fixture.clientId } });
    expect(client?.status).toBe(ClientStatus.ACTIVE);
    const invoice = await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } });
    expect(invoice?.status).toBe(InvoiceStatus.PAID);

    // 5. Full audit trail: VALIDATION (old/new) + RECONNECT with policyRef
    const validationAudit = await prisma.auditLog.findFirst({
      where: { entity: 'Payment', action: 'VALIDATION', entityId: fixture.paymentId },
    });
    expect(validationAudit).not.toBeNull();
    expect((validationAudit?.oldValues as { status: string }).status).toBe(
      PaymentStatus.PENDING_VALIDATION,
    );

    const reconnectAudit = await prisma.auditLog.findFirst({
      where: { entity: 'NetworkAccess', action: 'RECONNECT', entityId: fixture.networkAccessId },
    });
    expect(reconnectAudit).not.toBeNull();
    expect(reconnectAudit?.policyRef).toBe('ISO/IEC 38500 - Responsabilidad');

    // 6. Experimental metric recorded and within the 5-minute SLA
    const metric = await prisma.operationalMetric.findFirst({
      where: { metricType: 'RECONNECTION_TIME_MINUTES' },
      orderBy: { measuredAt: 'desc' },
    });
    expect(metric).not.toBeNull();
    expect(metric?.value).toBeLessThan(5);
  }, 60000);

  it('rechaza la validación sin comprobante para transferencias', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: adminEmail, password: adminPassword })
      .expect(200);
    const token = login.body.accessToken;

    const registered = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceId: fixture.invoiceId,
        amount: 60000,
        paymentMethod: 'BANK_TRANSFER',
        reference: `TRF-${suffix}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/payments/${registered.body.id}/validate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approve: true })
      .expect(400);

    // Reject it with a reason instead → client gets notified
    await request(app.getHttpServer())
      .patch(`/api/payments/${registered.body.id}/validate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approve: false, reason: 'Sin comprobante adjunto' })
      .expect(200);

    const notification = await prisma.notification.findFirst({
      where: { clientId: fixture.clientId, type: 'PAYMENT_REJECTED' },
    });
    expect(notification).not.toBeNull();
  }, 30000);
});
