import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class ApplyDiscountDto {
  @ApiProperty({ description: 'Valor del descuento en COP', example: 10000 })
  @IsInt({ message: 'El descuento debe ser un entero en COP' })
  @IsPositive({ message: 'El descuento debe ser positivo' })
  amount!: number;

  @ApiProperty({ description: 'Motivo de la aprobación (obligatorio)' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo del descuento es obligatorio' })
  reason!: string;
}
