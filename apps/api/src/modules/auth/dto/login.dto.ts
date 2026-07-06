import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Correo electrónico o número de documento (cédula)',
    example: 'admin@unitik.com.co',
  })
  @IsString()
  @IsNotEmpty({ message: 'El correo o documento es obligatorio' })
  identifier!: string;

  @ApiProperty({ description: 'Contraseña', example: 'Admin123*' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;
}
