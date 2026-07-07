import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class CreatePromiseDto {
  @ApiProperty()
  @IsUUID('4', { message: 'invoiceId debe ser un UUID válido' })
  invoiceId!: string;

  @ApiProperty({ description: 'Días de plazo adicional: 7 o 15 (política UNITIK)', example: 7 })
  @IsIn([7, 15], { message: 'La promesa de pago solo admite 7 o 15 días' })
  daysExtension!: number;
}
