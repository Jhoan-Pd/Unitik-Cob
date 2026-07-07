import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePlanDto } from './create-plan.dto';

export class UpdatePlanDto extends PartialType(CreatePlanDto) {
  @ApiPropertyOptional({ description: 'Desactivar el plan (no se borra: hay suscripciones)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
