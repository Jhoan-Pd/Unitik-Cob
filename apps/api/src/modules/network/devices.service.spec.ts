import { Test } from '@nestjs/testing';
import { DeviceType } from '@prisma/client';
import { decryptSecret } from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';
import { DevicesService } from './devices.service';

describe('DevicesService (Política 2 — credenciales cifradas)', () => {
  let service: DevicesService;

  const prismaMock = {
    networkDevice: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  const dbDevice = {
    id: 'device-1',
    name: 'RB Principal',
    deviceType: DeviceType.ROUTERBOARD,
    ipAddress: '192.168.88.1',
    apiPort: 8728,
    apiUsername: 'api',
    apiPasswordEnc: 'iv.tag.data',
    location: 'Torre principal',
    isMain: true,
    isActive: true,
    lastPing: null,
  };

  beforeAll(() => {
    process.env.DEVICE_SECRET_KEY = 'b'.repeat(64);
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DevicesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(DevicesService);
    jest.clearAllMocks();
  });

  it('cifra la contraseña con AES-256-GCM y nunca la devuelve', async () => {
    prismaMock.networkDevice.create.mockImplementationOnce(({ data }) =>
      Promise.resolve({ ...dbDevice, ...data }),
    );

    const device = await service.create({
      name: 'RB Principal',
      deviceType: DeviceType.ROUTERBOARD,
      ipAddress: '192.168.88.1',
      apiUsername: 'api',
      apiPassword: 'super-secreta',
      location: 'Torre principal',
    });

    const stored = prismaMock.networkDevice.create.mock.calls[0][0].data.apiPasswordEnc;
    expect(stored).not.toContain('super-secreta');
    expect(decryptSecret(stored)).toBe('super-secreta');
    expect(device).not.toHaveProperty('apiPasswordEnc');
    expect(device).not.toHaveProperty('apiPassword');
  });

  it('deriva el estado online/offline/unknown desde lastPing', async () => {
    prismaMock.networkDevice.findMany.mockResolvedValueOnce([
      { ...dbDevice, id: 'd1', lastPing: new Date() },
      { ...dbDevice, id: 'd2', lastPing: new Date(Date.now() - 10 * 60_000) },
      { ...dbDevice, id: 'd3', lastPing: null },
    ]);

    const devices = await service.findAll();
    expect(devices.map((d) => d.status)).toEqual(['online', 'offline', 'unknown']);
  });

  it('update devuelve el estado previo para auditoría', async () => {
    prismaMock.networkDevice.findUnique.mockResolvedValueOnce(dbDevice);
    prismaMock.networkDevice.update.mockResolvedValueOnce({ ...dbDevice, isActive: false });

    const { device, previous } = await service.update('device-1', { isActive: false });
    expect(previous.isActive).toBe(true);
    expect(device.isActive).toBe(false);
  });
});
