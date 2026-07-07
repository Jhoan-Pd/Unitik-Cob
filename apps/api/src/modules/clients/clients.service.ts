import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Client, ClientStatus, Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeClientStatusDto } from './dto/change-client-status.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

export type ClientWithUser = Client & { user: Omit<User, 'passwordHash'> };

/** Maps target status to the domain action recorded in the audit trail. */
export const STATUS_AUDIT_ACTION: Record<ClientStatus, string> = {
  ACTIVE: 'REACTIVATE',
  SUSPENDED: 'SUSPEND',
  CUT: 'CUT',
  CANCELLED: 'CANCEL',
};

const USER_PUBLIC_SELECT = {
  id: true,
  documentId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the CLIENT user and the client record atomically. */
  async create(dto: CreateClientDto): Promise<ClientWithUser> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { documentId: dto.documentId }] },
    });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese correo o cédula');
    }

    // Default portal password: the document id (interview: clients log in
    // with documento y contraseña); change on first login arrives in It. 6.
    const passwordHash = await bcrypt.hash(dto.password ?? dto.documentId, 10);

    return this.prisma.client.create({
      data: {
        clientCode: `CLI-${dto.documentId}`,
        address: dto.address,
        neighborhood: dto.neighborhood,
        municipality: dto.municipality ?? 'Cumbitara',
        department: dto.department ?? 'Nariño',
        gpsLat: dto.gpsLat,
        gpsLng: dto.gpsLng,
        serviceType: dto.serviceType,
        paymentModality: dto.paymentModality,
        installationDate: new Date(dto.installationDate),
        user: {
          create: {
            documentId: dto.documentId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: Role.CLIENT,
          },
        },
      },
      include: { user: { select: USER_PUBLIC_SELECT } },
    });
  }

  async findAll(filters: {
    status?: ClientStatus;
    search?: string;
  }): Promise<ClientWithUser[]> {
    const where: Prisma.ClientWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.user = {
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { documentId: { contains: filters.search } },
        ],
      };
    }
    return this.prisma.client.findMany({
      where,
      include: { user: { select: USER_PUBLIC_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<ClientWithUser> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { user: { select: USER_PUBLIC_SELECT } },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  /** Self-service profile for the client portal (CLIENT role). */
  async findByUserId(userId: string): Promise<ClientWithUser> {
    const client = await this.prisma.client.findUnique({
      where: { userId },
      include: { user: { select: USER_PUBLIC_SELECT } },
    });
    if (!client) throw new NotFoundException('El usuario no tiene un cliente asociado');
    return client;
  }

  async update(
    id: string,
    dto: UpdateClientDto,
  ): Promise<{ client: ClientWithUser; previous: ClientWithUser }> {
    const previous = await this.findOne(id);

    const { firstName, lastName, email, phone, installationDate, ...clientFields } = dto;
    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...clientFields,
        ...(installationDate ? { installationDate: new Date(installationDate) } : {}),
        ...(firstName || lastName || email || phone
          ? { user: { update: { firstName, lastName, email, phone } } }
          : {}),
      },
      include: { user: { select: USER_PUBLIC_SELECT } },
    });
    return { client, previous };
  }

  /** Status transitions (suspend/reactivate/cut/cancel) — always with reason. */
  async changeStatus(
    id: string,
    dto: ChangeClientStatusDto,
  ): Promise<{ client: ClientWithUser; previous: ClientWithUser; action: string }> {
    const previous = await this.findOne(id);
    if (previous.status === dto.status) {
      throw new ConflictException(`El cliente ya está en estado ${dto.status}`);
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: { status: dto.status },
      include: { user: { select: USER_PUBLIC_SELECT } },
    });
    return { client, previous, action: STATUS_AUDIT_ACTION[dto.status] };
  }
}
