import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, SystemConfig } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SystemConfigService } from './system-config.service';

/**
 * Admin-editable system parameters (interest rate, cut-off days, fees...).
 * ISO/IEC 38500 — Strategy + Conformance: parameter changes are audited
 * with previous and new values.
 */
@ApiTags('system-config')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los parámetros del sistema' })
  findAll(): Promise<SystemConfig[]> {
    return this.configService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Consultar un parámetro' })
  findOne(@Param('key') key: string): Promise<SystemConfig> {
    return this.configService.findOne(key);
  }

  @Patch(':key')
  @Audited({ entity: 'SystemConfig' })
  @ApiOperation({ summary: 'Actualizar el valor de un parámetro (auditado)' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request & { auditOldValues?: unknown },
  ): Promise<SystemConfig> {
    const { config, previous } = await this.configService.update(key, dto.value, user.id);
    request.auditOldValues = previous;
    return config;
  }
}
