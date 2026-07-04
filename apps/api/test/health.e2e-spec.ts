import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('GET /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports system health with all tracked dependencies', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toMatch(/ok|degraded/);
    expect(response.body.timezone).toBe('America/Bogota');
    expect(response.body.dependencies).toEqual(
      expect.objectContaining({
        database: expect.any(String),
        redis: expect.any(String),
        routerboard: 'not_configured',
        whatsapp: 'not_configured',
        paymentGateway: 'not_configured',
      }),
    );
  });
});
