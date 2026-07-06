import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** User shape returned by the API — passwordHash never leaves the service. */
export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(role?: Role): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.toPublic(user));
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toPublic(user);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { documentId: dto.documentId }] },
    });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese correo o cédula');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        documentId: dto.documentId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        role: dto.role,
        passwordHash,
      },
    });
    return this.toPublic(user);
  }

  /**
   * Updates a user. There is NO hard delete: accounts are deactivated
   * (isActive = false) to preserve traceability of their audit history.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<{ user: PublicUser; previous: PublicUser }> {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Usuario no encontrado');

    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return { user: this.toPublic(user), previous: this.toPublic(current) };
  }

  private toPublic(user: User): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }
}
