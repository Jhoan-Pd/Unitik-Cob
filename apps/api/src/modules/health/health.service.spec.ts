import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  const prismaMock = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(HealthService);
    jest.clearAllMocks();
  });

  it('reports database up when the query succeeds', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const report = await service.check();
    expect(report.dependencies.database).toBe('up');
    expect(report.timezone).toBe('America/Bogota');
  });

  it('reports degraded status when the database is down', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const report = await service.check();
    expect(report.dependencies.database).toBe('down');
    expect(report.status).toBe('degraded');
  });
});
