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
import { Plan, Role, ServiceType } from '@prisma/client';
import { Request } from 'express';
import { Audited } from '../../common/decorators/audited.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'Listar planes (cualquier usuario autenticado)' })
  @ApiQuery({ name: 'serviceType', enum: ServiceType, required: false })
  @ApiQuery({ name: 'onlyActive', required: false, type: Boolean })
  findAll(
    @Query('serviceType') serviceType?: ServiceType,
    @Query('onlyActive') onlyActive?: string,
  ): Promise<Plan[]> {
    return this.plansService.findAll({ serviceType, onlyActive: onlyActive === 'true' });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un plan' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Plan> {
    return this.plansService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @Audited({ entity: 'Plan' })
  @ApiOperation({ summary: 'Crear plan (solo ADMIN, auditado)' })
  create(@Body() dto: CreatePlanDto): Promise<Plan> {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @Audited({ entity: 'Plan' })
  @ApiOperation({ summary: 'Editar plan: velocidad, precio, reúso, TV (auditado)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @Req() request: Request & { auditOldValues?: unknown },
  ): Promise<Plan> {
    const { plan, previous } = await this.plansService.update(id, dto);
    request.auditOldValues = previous;
    return plan;
  }
}
