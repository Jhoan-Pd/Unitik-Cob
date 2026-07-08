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
import { Ticket, TicketStatus } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

/** Any authenticated role interacts with tickets; visibility is scoped per role. */
@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar tickets (cliente: propios; técnico: asignados; admin/cajero: todos)',
  })
  @ApiQuery({ name: 'status', enum: TicketStatus, required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: TicketStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('clientId') clientId?: string,
  ): Promise<Ticket[]> {
    return this.ticketsService.findAll(user, { status, assignedToId, clientId });
  }

  @Post()
  @Audited({ entity: 'Ticket' })
  @ApiOperation({ summary: 'Crear ticket de soporte (número TKT-<año>-<consecutivo>)' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser): Promise<Ticket> {
    return this.ticketsService.create(dto, user);
  }

  @Patch(':id')
  @Audited({ entity: 'Ticket' })
  @ApiOperation({ summary: 'Asignar técnico / cambiar estado o prioridad (auditado)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request & { auditOldValues?: unknown },
  ): Promise<Ticket> {
    const { ticket, previous } = await this.ticketsService.update(id, dto, user);
    request.auditOldValues = previous;
    return ticket;
  }
}
