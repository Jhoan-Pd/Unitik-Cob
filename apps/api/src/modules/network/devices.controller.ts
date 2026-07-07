import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { NetworkRateLimitGuard } from '../../common/guards/network-rate-limit.guard';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService, PublicDevice } from './devices.service';
import { MikrotikService } from './mikrotik.service';

/**
 * NetworkDevice management (Policy 2 — only ADMIN/TECHNICIAN, rate-limited,
 * fully audited with IP and user-agent via the global interceptor).
 */
@ApiTags('network-devices')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.TECHNICIAN)
@UseGuards(NetworkRateLimitGuard)
@Controller('network/devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly mikrotikService: MikrotikService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar dispositivos con estado online/offline' })
  findAll(): Promise<PublicDevice[]> {
    return this.devicesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un dispositivo' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicDevice> {
    return this.devicesService.findOne(id);
  }

  @Post()
  @Audited({ entity: 'NetworkDevice' })
  @ApiOperation({ summary: 'Registrar RouterBoard/OLT/AP (contraseña cifrada AES-256-GCM)' })
  create(@Body() dto: CreateDeviceDto): Promise<PublicDevice> {
    return this.devicesService.create(dto);
  }

  @Patch(':id')
  @Audited({ entity: 'NetworkDevice' })
  @ApiOperation({ summary: 'Actualizar dispositivo (auditado con old/new)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
    @Req() request: Request & { auditOldValues?: unknown },
  ): Promise<PublicDevice> {
    const { device, previous } = await this.devicesService.update(id, dto);
    request.auditOldValues = previous;
    return device;
  }

  @Post(':id/ping')
  @Audited({ entity: 'NetworkDevice', action: 'PING' })
  @ApiOperation({ summary: 'Probar conectividad (actualiza lastPing y el estado)' })
  async ping(@Param('id', ParseUUIDPipe) id: string): Promise<{ online: boolean }> {
    return { online: await this.mikrotikService.ping(id) };
  }
}
