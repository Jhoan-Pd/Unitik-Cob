import { Injectable, NotFoundException } from '@nestjs/common';
import { NetworkDevice } from '@prisma/client';
import { encryptSecret } from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

/** Device shape returned by the API — the encrypted secret never leaves. */
export type PublicDevice = Omit<NetworkDevice, 'apiPasswordEnc'> & {
  status: 'online' | 'offline' | 'unknown';
};

/** A device is "online" if it answered a ping within this window. */
const ONLINE_WINDOW_MS = 5 * 60_000;

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeviceDto): Promise<PublicDevice> {
    const { apiPassword, ...rest } = dto;
    const device = await this.prisma.networkDevice.create({
      data: { ...rest, apiPasswordEnc: encryptSecret(apiPassword) },
    });
    return this.toPublic(device);
  }

  async findAll(): Promise<PublicDevice[]> {
    const devices = await this.prisma.networkDevice.findMany({ orderBy: { name: 'asc' } });
    return devices.map((device) => this.toPublic(device));
  }

  async findOne(id: string): Promise<PublicDevice> {
    const device = await this.prisma.networkDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    return this.toPublic(device);
  }

  async update(
    id: string,
    dto: UpdateDeviceDto,
  ): Promise<{ device: PublicDevice; previous: PublicDevice }> {
    const current = await this.prisma.networkDevice.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Dispositivo no encontrado');

    const { apiPassword, ...rest } = dto;
    const device = await this.prisma.networkDevice.update({
      where: { id },
      data: { ...rest, ...(apiPassword ? { apiPasswordEnc: encryptSecret(apiPassword) } : {}) },
    });
    return { device: this.toPublic(device), previous: this.toPublic(current) };
  }

  private toPublic(device: NetworkDevice): PublicDevice {
    const { apiPasswordEnc: _apiPasswordEnc, ...publicDevice } = device;
    const status = !device.lastPing
      ? ('unknown' as const)
      : Date.now() - device.lastPing.getTime() < ONLINE_WINDOW_MS
        ? ('online' as const)
        : ('offline' as const);
    return { ...publicDevice, status };
  }
}
