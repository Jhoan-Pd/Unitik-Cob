import { Injectable, NotFoundException } from '@nestjs/common';
import { SystemConfig } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Editable business parameters (golden rule #3: prices, rates and cut-off
 * days are never hardcoded — they live in system_config).
 * Keys are created by the seed; this service reads and updates values only,
 * so a typo can never silently create an unused parameter.
 */
@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<SystemConfig[]> {
    return this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async findOne(key: string): Promise<SystemConfig> {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundException(`Parámetro "${key}" no existe`);
    return config;
  }

  /** Typed helper for domain modules: reads a numeric parameter. */
  async getNumber(key: string): Promise<number> {
    const config = await this.findOne(key);
    const value = Number(config.value);
    if (Number.isNaN(value)) {
      throw new NotFoundException(`Parámetro "${key}" no es numérico: "${config.value}"`);
    }
    return value;
  }

  async update(
    key: string,
    value: string,
    updatedBy: string,
  ): Promise<{ config: SystemConfig; previous: SystemConfig }> {
    const previous = await this.findOne(key);
    const config = await this.prisma.systemConfig.update({
      where: { key },
      data: { value, updatedBy },
    });
    return { config, previous };
  }
}
