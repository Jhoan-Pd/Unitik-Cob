import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsUUID } from 'class-validator';

export class ReceiveCashDto {
  @ApiProperty({ description: 'Factura que paga el cliente' })
  @IsUUID('4', { message: 'invoiceId debe ser un UUID válido' })
  invoiceId!: string;

  @ApiProperty({ description: 'Monto recibido en efectivo (COP)', example: 60000 })
  @IsInt({ message: 'El monto debe ser un entero en COP' })
  @IsPositive({ message: 'El monto debe ser positivo' })
  amount!: number;
}
