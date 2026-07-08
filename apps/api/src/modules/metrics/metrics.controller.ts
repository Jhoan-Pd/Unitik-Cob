import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OperationalMetric, Phase, Prisma, Role } from '@prisma/client';
import { Audited } from '../../common/decorators/audited.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordBaselineDto } from './dto/record-baseline.dto';
import { ExperimentalMetrics, MetricsService } from './metrics.service';

@ApiTags('metrics')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('baseline')
  @Audited({ entity: 'OperationalMetric', action: 'BASELINE_MEASUREMENT' })
  @ApiOperation({
    summary:
      'Registrar una medición BASELINE de campo (antes de operar el sistema) para la validación experimental',
  })
  recordBaseline(@Body() dto: RecordBaselineDto): Promise<OperationalMetric> {
    return this.prisma.operationalMetric.create({
      data: {
        metricType: dto.metricType,
        phase: Phase.BASELINE,
        value: dto.value,
        measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
        contextJson: (dto.contextJson ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

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
