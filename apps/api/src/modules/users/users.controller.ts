import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUser, UsersService } from './users.service';

/**
 * User management — ADMIN only (RBAC, ISO/IEC 38500 Responsibility).
 * All mutations are audited by the global interceptor via @Audited.
 */
@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios (filtro opcional por rol)' })
  @ApiQuery({ name: 'role', enum: Role, required: false })
  findAll(@Query('role') role?: Role): Promise<PublicUser[]> {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un usuario' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicUser> {
    return this.usersService.findOne(id);
  }

  @Post()
  @Audited({ entity: 'User' })
  @ApiOperation({ summary: 'Crear usuario (ADMIN, TECHNICIAN, CASHIER o CLIENT)' })
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Audited({ entity: 'User' })
  @ApiOperation({ summary: 'Actualizar usuario (incluye activar/desactivar)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: Request & { auditOldValues?: unknown },
  ): Promise<PublicUser> {
    const { user, previous } = await this.usersService.update(id, dto);
    request.auditOldValues = previous; // picked up by AuditInterceptor
    return user;
  }
}
