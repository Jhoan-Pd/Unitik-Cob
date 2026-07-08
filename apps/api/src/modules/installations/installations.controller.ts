import { Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InstallationRecord, Role } from '@prisma/client';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstallationDto } from './dto/create-installation.dto';

/**
 * Installation records (acta del técnico con firma digital del cliente).
 * ISO/IEC 38500 — Responsibility: the record ties technician, equipment
 * and client signature to the installation.
 */
@ApiTags('installations')
@ApiBearerAuth()
@Controller('installations')
export class InstallationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles(Role.TECHNICIAN, Role.ADMIN)
  @Audited({ entity: 'InstallationRecord' })
  @ApiOperation({ summary: 'Registrar acta de instalación (equipos, cable, firma)' })
  async create(
    @Body() dto: CreateInstallationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InstallationRecord> {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    return this.prisma.installationRecord.create({
      data: {
        clientId: dto.clientId,
        technicianId: user.id,
        serviceType: dto.serviceType,
        cableMeters: dto.cableMeters,
        equipmentList: dto.equipmentList,
        clientPaidEquipment: dto.clientPaidEquipment ?? false,
        observations: dto.observations,
        installationDate: new Date(dto.installationDate),
        signedUrl: dto.signedUrl,
      },
    });
  }

  @Get()
  @Roles(Role.TECHNICIAN, Role.ADMIN)
  @ApiOperation({ summary: 'Actas por cliente o técnico' })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'technicianId', required: false })
  findAll(
    @Query('clientId') clientId?: string,
    @Query('technicianId') technicianId?: string,
  ): Promise<InstallationRecord[]> {
    return this.prisma.installationRecord.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(technicianId ? { technicianId } : {}),
      },
      orderBy: { installationDate: 'desc' },
      take: 200,
    });
  }
}
