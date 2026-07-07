import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClientStatus, Role } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientsService, ClientWithUser } from './clients.service';
import { ChangeClientStatusDto } from './dto/change-client-status.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

type AuditableRequest = Request & { auditOldValues?: unknown };

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('me')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Mi información (portal cliente)' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<ClientWithUser> {
    return this.clientsService.findByUserId(user.id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.CASHIER)
  @ApiOperation({ summary: 'Listar clientes (filtros: estado, búsqueda)' })
  @ApiQuery({ name: 'status', enum: ClientStatus, required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Nombre, apellido o cédula' })
  findAll(
    @Query('status') status?: ClientStatus,
    @Query('search') search?: string,
  ): Promise<ClientWithUser[]> {
    return this.clientsService.findAll({ status, search });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.CASHIER)
  @ApiOperation({ summary: 'Consultar un cliente' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ClientWithUser> {
    return this.clientsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Audited({ entity: 'Client' })
  @ApiOperation({ summary: 'Registrar cliente (técnico en instalación o admin)' })
  create(@Body() dto: CreateClientDto): Promise<ClientWithUser> {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Audited({ entity: 'Client' })
  @ApiOperation({ summary: 'Actualizar datos del cliente' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @Req() request: AuditableRequest,
  ): Promise<ClientWithUser> {
    const { client, previous } = await this.clientsService.update(id, dto);
    request.auditOldValues = previous;
    return client;
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @Audited({ entity: 'Client', action: 'STATUS_CHANGE' })
  @ApiOperation({ summary: 'Suspender, reactivar, cortar o cancelar (solo ADMIN, con motivo)' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeClientStatusDto,
    @Req() request: AuditableRequest,
  ): Promise<ClientWithUser> {
    const { client, previous, action } = await this.clientsService.changeStatus(id, dto);
    request.auditOldValues = { status: previous.status, action, reason: dto.reason };
    return client;
  }
}
