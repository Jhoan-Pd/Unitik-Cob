import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetricType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsObject, IsOptional, Min } from 'class-validator';

export class RecordBaselineDto {
  @ApiProperty({ enum: MetricType, example: MetricType.RECONNECTION_TIME_MINUTES })
  @IsEnum(MetricType, {
    message:
      'metricType inválido: RECONNECTION_TIME_MINUTES, ADMIN_REWORK_COUNT, COMPLAINT_COUNT o TRACEABILITY_PERCENT',
  })
  metricType!: MetricType;

  @ApiProperty({
    description: 'Valor medido en campo (minutos, conteo o porcentaje según la métrica)',
    example: 240,
  })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ description: 'Fecha real de la medición (ISO); por defecto ahora' })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @ApiPropertyOptional({
    description: 'Contexto de la medición (cliente, observador, condiciones)',
    example: { fuente: 'observación directa', observador: 'tesista' },
  })
  @IsOptional()
  @IsObject()
  contextJson?: Record<string, unknown>;
}
