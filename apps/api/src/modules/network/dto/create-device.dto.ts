import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ example: 'RouterBoard Principal Cumbitara' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  @ApiProperty({ enum: DeviceType, example: DeviceType.ROUTERBOARD })
  @IsEnum(DeviceType, { message: 'Tipo inválido: ROUTERBOARD, OLT, AP, SWITCH u OTHER' })
  deviceType!: DeviceType;

  @ApiProperty({ example: '192.168.88.1' })
  @IsIP('4', { message: 'La dirección IP no es válida' })
  ipAddress!: string;

  @ApiPropertyOptional({ default: 8728, description: 'Puerto RouterOS API' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  apiPort?: number;

  @ApiProperty({ example: 'api-unitik' })
  @IsString()
  @IsNotEmpty({ message: 'El usuario del API es obligatorio' })
  apiUsername!: string;

  @ApiProperty({ description: 'Contraseña del API (se cifra AES-256-GCM, nunca se devuelve)' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña del API es obligatoria' })
  apiPassword!: string;

  @ApiProperty({ example: 'Torre principal, casco urbano' })
  @IsString()
  @IsNotEmpty({ message: 'La ubicación es obligatoria' })
  location!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}
