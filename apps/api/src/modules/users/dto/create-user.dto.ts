import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'Cédula de ciudadanía', example: '1085123456' })
  @Matches(/^\d{6,10}$/, { message: 'La cédula debe tener entre 6 y 10 dígitos' })
  documentId!: string;

  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  firstName!: string;

  @ApiProperty({ example: 'Rodríguez' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  lastName!: string;

  @ApiProperty({ example: 'maria@unitik.com.co' })
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  @ApiProperty({ description: 'Celular colombiano (10 dígitos)', example: '3151234567' })
  @Matches(/^3\d{9}$/, { message: 'El celular debe ser colombiano: 10 dígitos iniciando en 3' })
  phone!: string;

  @ApiProperty({ minLength: 8 })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;

  @ApiProperty({ enum: Role, example: Role.CASHIER })
  @IsEnum(Role, { message: 'Rol inválido: ADMIN, TECHNICIAN, CASHIER o CLIENT' })
  role!: Role;
}
