import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Phase, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExperimentalMetrics, MetricsService } from './metrics.service';

@ApiTags('metrics')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('experimental')
  @ApiOperation({
    summary: 'Las 4 métricas de validación experimental (BASELINE vs POST_INTERVENTION)',
  })
  @ApiQuery({ name: 'phase', enum: Phase })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  experimental(
    @Query('phase') phase: Phase,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ExperimentalMetrics> {
    if (!phase || !Object.values(Phase).includes(phase)) {
      throw new BadRequestException('phase debe ser BASELINE o POST_INTERVENTION');
    }
    return this.metricsService.experimental(
      phase,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
