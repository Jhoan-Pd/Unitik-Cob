import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateConfigDto {
  @ApiProperty({ description: 'Nuevo valor del parámetro', example: '3.0' })
  @IsString()
  @IsNotEmpty({ message: 'El valor es obligatorio' })
  value!: string;
}
