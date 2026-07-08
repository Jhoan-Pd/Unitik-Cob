import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
} from 'class-validator';

export class CreateInstallationDto {
  @ApiProperty()
  @IsUUID('4')
  clientId!: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @ApiPropertyOptional({ description: 'Metros de cable usados (radio enlace)', example: 35.5 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cableMeters?: number;

  @ApiProperty({
    description: 'Equipos usados',
    example: [{ item: 'Antena LiteBeam', quantity: 1 }],
  })
  @IsArray()
  equipmentList!: Array<{ item: string; quantity: number }>;

  @ApiPropertyOptional({ description: 'El cliente pagó equipos adicionales', default: false })
  @IsOptional()
  @IsBoolean()
  clientPaidEquipment?: boolean;

  @ApiPropertyOptional({ example: 'Señal -58 dBm; se fijó mástil de 3 m' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ example: '2026-07-07' })
  @IsDateString()
  installationDate!: string;

  @ApiPropertyOptional({ description: 'URL de la firma digital del cliente' })
  @IsOptional()
  @IsUrl()
  signedUrl?: string;
}
