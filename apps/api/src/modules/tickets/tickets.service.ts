import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, Ticket, TicketStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

/**
 * Support tickets. Ticket numbers are TKT-<year>-<seq>. Metric note:
 * tickets with category BILLING or RECONNECTION_COMPLAINT feed the
 * COMPLAINT_COUNT experimental metric (Phase 4).
 */
@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTicketDto, user: AuthenticatedUser): Promise<Ticket> {
    let clientId = dto.clientId;
    if (user.role === Role.CLIENT) {
      // Portal: the client can only open tickets for themselves
      const client = await this.prisma.client.findUnique({ where: { userId: user.id } });
      if (!client) throw new NotFoundException('El usuario no tiene un cliente asociado');
      clientId = client.id;
    } else if (!clientId) {
      throw new NotFoundException('clientId es obligatorio para personal interno');
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.ticket.count({
      where: { ticketNumber: { startsWith: `TKT-${year}-` } },
    });
    const ticketNumber = `TKT-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.ticket.create({
      data: {
        ticketNumber,
        clientId: clientId as string,
        createdById: user.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
      },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filters: { status?: TicketStatus; assignedToId?: string; clientId?: string },
  ): Promise<Ticket[]> {
    const where: Prisma.TicketWhereInput = { ...filters };
    if (user.role === Role.CLIENT) {
      const client = await this.prisma.client.findUnique({ where: { userId: user.id } });
      if (!client) throw new NotFoundException('El usuario no tiene un cliente asociado');
      where.clientId = client.id; // portal: only own tickets
    } else if (user.role === Role.TECHNICIAN && !filters.assignedToId) {
      where.assignedToId = user.id; // technician default view: my assigned tickets
    }
    return this.prisma.ticket.findMany({
      where,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
  }

  async update(
    id: string,
    dto: UpdateTicketDto,
    user: AuthenticatedUser,
  ): Promise<{ ticket: Ticket; previous: Ticket }> {
    const previous = await this.prisma.ticket.findUnique({ where: { id } });
    if (!previous) throw new NotFoundException('Ticket no encontrado');
    if (user.role === Role.TECHNICIAN && previous.assignedToId !== user.id) {
      throw new ForbiddenException('Solo puede gestionar tickets asignados a usted');
    }

    const closesNow =
      dto.status === TicketStatus.CLOSED && previous.status !== TicketStatus.CLOSED;
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { ...dto, ...(closesNow ? { closedAt: new Date() } : {}) },
    });
    return { ticket, previous };
  }
}
