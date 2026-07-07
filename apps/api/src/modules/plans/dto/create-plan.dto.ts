import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Plan 5 Fibra' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  @ApiProperty({ example: 'Fibra Óptica 200 Megas' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  description!: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType, { message: 'Tipo de servicio inválido: FIBER o RADIO' })
  serviceType!: ServiceType;

  @ApiProperty({ description: 'Velocidad en Mbps', example: 200 })
  @IsInt()
  @IsPositive({ message: 'La velocidad debe ser positiva' })
  speedMbps!: number;

  @ApiProperty({ description: 'Precio mensual en COP', example: 150000 })
  @IsInt({ message: 'El precio debe ser un entero en COP' })
  @IsPositive({ message: 'El precio debe ser positivo' })
  monthlyPrice!: number;

  @ApiPropertyOptional({ description: 'Costo de instalación en COP (por defecto: system_config)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  installationFee?: number;

  @ApiPropertyOptional({ description: 'Porcentaje de reúso (visible solo en admin)', example: 40 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reusePercent?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includesTv?: boolean;

  @ApiPropertyOptional({ description: 'Precio TV en COP', example: 10000 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  tvPrice?: number;
}
