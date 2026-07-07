import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsUUID('4', { message: 'clientId debe ser un UUID válido' })
  clientId!: string;

  @ApiProperty()
  @IsUUID('4', { message: 'planId debe ser un UUID válido' })
  planId!: string;

  @ApiPropertyOptional({ description: 'Inicio (ISO); por defecto hoy' })
  @IsOptional()
  @IsDateString({}, { message: 'Fecha de inicio inválida' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Día de corte (1-31); por defecto: system_config' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  cutOffDay?: number;
}
