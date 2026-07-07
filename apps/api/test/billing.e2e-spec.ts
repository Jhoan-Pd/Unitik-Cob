import { createHash } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceStatus, PrismaClient, Role } from '@prisma/client';
import request from 'supertest';

// Must be set BEFORE the AppModule loads so ConfigService picks it up
process.env.WOMPI_EVENTS_SECRET = 'e2e_wompi_secret';

import { AppModule } from '../src/app.module';
import { BillingService } from '../src/modules/invoices/billing.service';

/**
 * Iteration 4 e2e: monthly generation (idempotent + DIAN mock queued),
 * overdue interest, admin discount with reason, payment promise, and the
 * Wompi webhook as the only auto-validation path (signature enforced).
 */
describe('Facturación y pagos (e2e)', () => {
  let app: INestApplication;
  let billingService: BillingService;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const period = '2099-01'; // future period: never collides with the cron

  let adminToken = '';
  const fixture = { userId: '', clientId: '', subscriptionId: '', invoiceId: '', invoiceNumber: '' };

  const wompiEvent = (reference: string, amountCop: number, tamper = false) => {
    const transaction = {
      id: `txn-${suffix}`,
      status: 'APPROVED' as const,
      amount_in_cents: amountCop * 100,
      reference,
      payment_method_type: 'NEQUI',
    };
    const timestamp = Math.floor(Date.now() / 1000);
    const checksum = createHash('sha256')
      .update(
        `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${
          tamper ? 'wrong_secret' : 'e2e_wompi_secret'
        }`,
      )
      .digest('hex');
    return {
      event: 'transaction.updated',
      data: { transaction },
      timestamp,
      signature: {
        checksum,
        properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      },
    };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    billingService = app.get(BillingService);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identifier: process.env.SEED_ADMIN_EMAIL ?? 'admin@unitik.com.co',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*',
      })
      .expect(200);
    adminToken = login.body.accessToken;

    // Fixture: client with an active subscription on the 20-Mbps fiber plan
    const plan = await prisma.plan.findFirstOrThrow({
      where: { serviceType: 'FIBER', speedMbps: 20 },
    });
    const user = await prisma.user.create({
      data: {
        documentId: `88${suffix.slice(-8)}`,
        firstName: 'Facturado',
        lastName: 'Prueba',
        email: `bill-${suffix}@test.unitik.co`,
        phone: '3008888888',
        passwordHash: 'x',
        role: Role.CLIENT,
      },
    });
    fixture.userId = user.id;
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        clientCode: `BILL-${suffix}`,
        address: 'Calle 1 # 1-01',
        serviceType: 'FIBER',
        paymentModality: 'POSTPAID',
        installationDate: new Date(),
      },
    });
    fixture.clientId = client.id;
    const subscription = await prisma.subscription.create({
      data: { clientId: client.id, planId: plan.id, startDate: new Date(), cutOffDay: 10 },
    });
    fixture.subscriptionId = subscription.id;
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payment.deleteMany({ where: { invoice: { clientId: fixture.clientId } } });
      await prisma.paymentPromise.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.invoice.deleteMany({ where: { clientId: fixture.clientId } });
      await prisma.subscription.deleteMany({ where: { id: fixture.subscriptionId } });
      await prisma.client.deleteMany({ where: { id: fixture.clientId } });
      await prisma.user.deleteMany({ where: { id: fixture.userId } });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30000);

  it('genera la facturación del período (idempotente) y encola la factura DIAN', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/invoices/generate?period=${period}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(first.body.created).toBeGreaterThanOrEqual(1);

    // Idempotency: a second run creates nothing new for the same period
    const second = await request(app.getHttpServer())
      .post(`/api/invoices/generate?period=${period}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(second.body.created).toBe(0);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { invoiceNumber: `FCT-${period}-BILL-${suffix}` },
    });
    fixture.invoiceId = invoice.id;
    fixture.invoiceNumber = invoice.invoiceNumber;
    expect(Number(invoice.subtotal)).toBe(50000); // Plan 1 Fibra
    expect(invoice.status).toBe(InvoiceStatus.PENDING);

    // DIAN mock worker fills the CUFE (queued job)
    let cufe: string | null = null;
    for (let i = 0; i < 30 && !cufe; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const refreshed = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      cufe = refreshed?.electronicInvoiceCufe ?? null;
    }
    expect(cufe).toBeTruthy();
  }, 40000);

  let appliedInterest = 0;

  it('aplica interés por mora (tasa de system_config) al vencer', async () => {
    // The expected interest is computed from the CONFIGURED rate (golden
    // rule #3: the test must not hardcode business parameters either)
    const config = await prisma.systemConfig.findUniqueOrThrow({
      where: { key: 'interest_rate_percent' },
    });
    const rate = Number(config.value);

    await prisma.invoice.update({
      where: { id: fixture.invoiceId },
      data: { dueDate: new Date(Date.now() - 5 * 86_400_000) }, // venció hace 5 días
    });

    await billingService.applyOverdueRules();

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoiceId } });
    appliedInterest = Math.round(50000 * (rate / 100));
    expect(invoice.status).toBe(InvoiceStatus.OVERDUE);
    expect(Number(invoice.interest)).toBe(appliedInterest);
    expect(Number(invoice.total)).toBe(50000 + appliedInterest);
  });

  it('ADMIN aprueba descuento con motivo y queda auditado', async () => {
    const discounted = await request(app.getHttpServer())
      .patch(`/api/invoices/${fixture.invoiceId}/discount`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: appliedInterest, reason: 'Compensación por intermitencia del servicio' })
      .expect(200);
    expect(Number(discounted.body.total)).toBe(50000);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Invoice', action: 'DISCOUNT', entityId: fixture.invoiceId },
    });
    expect(audit).not.toBeNull();
    expect((audit?.oldValues as { reason: string }).reason).toContain('intermitencia');
  });

  it('registra promesa de pago de 7 días → factura en PROMISE_TO_PAY', async () => {
    await request(app.getHttpServer())
      .post('/api/payment-promises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId: fixture.invoiceId, daysExtension: 7 })
      .expect(201);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoiceId } });
    expect(invoice.status).toBe(InvoiceStatus.PROMISE_TO_PAY);

    // Solo 7 o 15 días
    await request(app.getHttpServer())
      .post('/api/payment-promises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId: fixture.invoiceId, daysExtension: 20 })
      .expect(400);
  });

  it('webhook Wompi: rechaza firma inválida y auto-valida la legítima (cumple la promesa)', async () => {
    await request(app.getHttpServer())
      .post('/api/payments/webhook/wompi')
      .send(wompiEvent(fixture.invoiceNumber, 50000, true))
      .expect(403);

    const ok = await request(app.getHttpServer())
      .post('/api/payments/webhook/wompi')
      .send(wompiEvent(fixture.invoiceNumber, 50000))
      .expect(200);
    expect(ok.body.processed).toBe(true);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoiceId } });
    expect(invoice.status).toBe(InvoiceStatus.PAID);

    const payment = await prisma.payment.findFirstOrThrow({
      where: { invoiceId: fixture.invoiceId },
    });
    expect(payment.autoValidated).toBe(true);
    expect(payment.status).toBe('VALIDATED');

    const promise = await prisma.paymentPromise.findFirstOrThrow({
      where: { invoiceId: fixture.invoiceId },
    });
    expect(promise.fulfilled).toBe(true);

    // Idempotencia: la misma transacción no se procesa dos veces
    const replay = await request(app.getHttpServer())
      .post('/api/payments/webhook/wompi')
      .send(wompiEvent(fixture.invoiceNumber, 50000))
      .expect(200);
    expect(replay.body.processed).toBe(false);
  });

  it('la vista de cartera expone totales y morosos para el admin', async () => {
    const portfolio = await request(app.getHttpServer())
      .get('/api/invoices/portfolio')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(portfolio.body).toHaveProperty('totalPending');
    expect(portfolio.body).toHaveProperty('totalOverdue');
    expect(Array.isArray(portfolio.body.byClient)).toBe(true);
  });
});
