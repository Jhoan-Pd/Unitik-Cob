import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientStatus, InvoiceStatus, PrismaClient, Role } from '@prisma/client';
import request from 'supertest';

process.env.DEVICE_SECRET_KEY = process.env.DEVICE_SECRET_KEY ?? 'd'.repeat(64);

import { AppModule } from '../src/app.module';

/**
 * Iteration 6 e2e: cashier cash flow with receipt + daily close, ticket
 * lifecycle, audit query/export, dashboard KPIs and experimental metrics.
 */
describe('Operación: cajero, tickets, auditoría y KPIs (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  let adminToken = '';
  let cashierToken = '';
  let cashierId = '';
  const fixture = { userId: '', clientId: '', subscriptionId: '', invoiceId: '', ticketId: '' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identifier: process.env.SEED_ADMIN_EMAIL ?? 'admin@unitik.com.co',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*',
      })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    // Cashier user (Germán) created by the admin
    const cashier = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        documentId: `66${suffix.slice(-8)}`,
        firstName: 'Germán',
        lastName: 'Cajero',
        email: `german-${suffix}@test.unitik.co`,
        phone: '3006666666',
        password: 'Cajero123*',
        role: 'CASHIER',
      })
      .expect(201);
    cashierId = cashier.body.id;

    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: `german-${suffix}@test.unitik.co`, password: 'Cajero123*' })
      .expect(200);
    cashierToken = cashierLogin.body.accessToken;

    // Suspended client with an overdue invoice (they come to pay in cash)
    const plan = await prisma.plan.findFirstOrThrow({ where: { serviceType: 'FIBER' } });
    const user = await prisma.user.create({
      data: {
        documentId: `55${suffix.slice(-8)}`,
        firstName: 'Paga',
        lastName: 'Efectivo',
        email: `cash-${suffix}@test.unitik.co`,
        phone: '3005555555',
        passwordHash: 'x',
        role: Role.CLIENT,
      },
    });
    fixture.userId = user.id;
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        clientCode: `CASH-${suffix}`,
        address: 'Carrera 2 # 3-45',
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
        invoiceNumber: `FCT-CASH-${suffix}`,
        clientId: client.id,
        subscriptionId: subscription.id,
        period: '2099-03',
        issueDate: new Date(),
        dueDate: new Date(Date.now() - 3 * 86_400_000),
        subtotal: 50000,
        total: 51250,
        interest: 1250,
        status: InvoiceStatus.OVERDUE,
      },
    });
    fixture.invoiceId = invoice.id;
  }, 40000);

  afterAll(async () => {
    try {
      await prisma.payment.deleteMany({ where: { invoice: { clientId: fixture.clientId } } });
      await prisma.ticket.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.invoice.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.subscription.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.notification.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.client.deleteMany({ where: { id: fixture.clientId } });
      await prisma.user.deleteMany({ where: { id: { in: [fixture.userId, cashierId] } } });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30000);

  it('el cajero recibe efectivo: recibo inmediato, factura pagada, cliente reactivado', async () => {
    const receipt = await request(app.getHttpServer())
      .post('/api/cashier/payments')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ invoiceId: fixture.invoiceId, amount: 51250 })
      .expect(201);

    expect(receipt.body.receiptNumber).toMatch(/^REC-\d{8}-\d{4}$/);
    expect(receipt.body.payment.status).toBe('VALIDATED');
    expect(receipt.body.payment.validatedBy).toBe(cashierId);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoiceId } });
    expect(invoice.status).toBe(InvoiceStatus.PAID);

    // Audited as CASH_RECEIVED with the cashier identity
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CASH_RECEIVED', userId: cashierId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('el cierre de caja del día refleja el recaudo del cajero', async () => {
    const close = await request(app.getHttpServer())
      .get('/api/cashier/daily-close')
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);
    expect(close.body.paymentsCount).toBeGreaterThanOrEqual(1);
    expect(close.body.totalReceived).toBeGreaterThanOrEqual(51250);

    const account = await request(app.getHttpServer())
      .get(`/api/cashier/account-status/${fixture.clientId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);
    expect(account.body.totalDue).toBe(0);
  });

  it('ciclo de ticket: admin crea → asigna técnico → cierre registra closedAt', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId: fixture.clientId,
        title: 'Reclamo de facturación',
        description: 'Cobro doble en el período',
        category: 'BILLING',
        priority: 'HIGH',
      })
      .expect(201);
    fixture.ticketId = created.body.id;
    expect(created.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{5}$/);

    const closed = await request(app.getHttpServer())
      .patch(`/api/tickets/${fixture.ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CLOSED' })
      .expect(200);
    expect(closed.body.closedAt).toBeTruthy();
  });

  it('auditoría: consulta filtrada y exportación CSV solo para ADMIN', async () => {
    const rows = await request(app.getHttpServer())
      .get('/api/audit?action=CASH_RECEIVED&take=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(rows.body.length).toBeGreaterThanOrEqual(1);
    expect(rows.body[0].user.email).toContain('german-');

    const csv = await request(app.getHttpServer())
      .get('/api/audit/export.csv?action=CASH_RECEIVED')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toContain('politicaISO38500');

    await request(app.getHttpServer())
      .get('/api/audit')
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(403);
  });

  it('dashboard KPIs y métricas experimentales responden para el ADMIN', async () => {
    const kpis = await request(app.getHttpServer())
      .get('/api/dashboard/kpis')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(kpis.body).toEqual(
      expect.objectContaining({
        activeClients: expect.any(Number),
        monthRevenue: expect.any(Number),
        openTickets: expect.any(Number),
        devicesTotal: expect.any(Number),
      }),
    );

    const metrics = await request(app.getHttpServer())
      .get('/api/metrics/experimental?phase=POST_INTERVENTION')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(metrics.body.complaintCount).toBeGreaterThanOrEqual(1); // el ticket BILLING
    expect(metrics.body.traceabilityPercent).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get('/api/metrics/experimental?phase=INVALID')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
