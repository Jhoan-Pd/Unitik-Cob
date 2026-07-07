import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentModality, ServiceType } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  // --- Identity (User with CLIENT role) ---
  @ApiProperty({ description: 'Cédula de ciudadanía', example: '1085123456' })
  @Matches(/^\d{6,10}$/, { message: 'La cédula debe tener entre 6 y 10 dígitos' })
  documentId!: string;

  @ApiProperty({ example: 'Rosa' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  firstName!: string;

  @ApiProperty({ example: 'Delgado' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  lastName!: string;

  @ApiProperty({ example: 'rosa@correo.com' })
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  @ApiProperty({ description: 'Celular colombiano', example: '3151234567' })
  @Matches(/^3\d{9}$/, { message: 'El celular debe ser colombiano: 10 dígitos iniciando en 3' })
  phone!: string;

  @ApiPropertyOptional({
    description: 'Contraseña del portal; si se omite, se usa la cédula (cambio recomendado al primer ingreso)',
  })
  @IsOptional()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  // --- Service location ---
  @ApiProperty({ example: 'Calle 3 # 4-21, Barrio Centro' })
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  address!: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ default: 'Cumbitara' })
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional({ default: 'Nariño' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Latitud GPS capturada en instalación', example: 1.6477 })
  @IsOptional()
  @IsLatitude({ message: 'Latitud inválida' })
  gpsLat?: number;

  @ApiPropertyOptional({ description: 'Longitud GPS', example: -77.5787 })
  @IsOptional()
  @IsLongitude({ message: 'Longitud inválida' })
  gpsLng?: number;

  // --- Service ---
  @ApiProperty({ enum: ServiceType, example: ServiceType.FIBER })
  @IsEnum(ServiceType, { message: 'Tipo de servicio inválido: FIBER o RADIO' })
  serviceType!: ServiceType;

  @ApiProperty({ enum: PaymentModality, example: PaymentModality.POSTPAID })
  @IsEnum(PaymentModality, { message: 'Modalidad inválida: PREPAID o POSTPAID' })
  paymentModality!: PaymentModality;

  @ApiProperty({ description: 'Fecha de instalación (ISO)', example: '2026-07-01' })
  @IsDateString({}, { message: 'Fecha de instalación inválida' })
  installationDate!: string;
}
