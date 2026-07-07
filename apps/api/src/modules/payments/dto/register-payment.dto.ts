import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID, IsUrl } from 'class-validator';

export class RegisterPaymentDto {
  @ApiProperty({ description: 'Factura que se está pagando' })
  @IsUUID('4', { message: 'invoiceId debe ser un UUID válido' })
  invoiceId!: string;

  @ApiProperty({ description: 'Monto pagado en COP (sin decimales)', example: 60000 })
  @IsInt({ message: 'El monto debe ser un entero en COP' })
  @IsPositive({ message: 'El monto debe ser positivo' })
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.NEQUI })
  @IsEnum(PaymentMethod, { message: 'Método de pago inválido' })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Número de comprobante Nequi/transferencia' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'URL del comprobante subido' })
  @IsOptional()
  @IsUrl({}, { message: 'proofUrl debe ser una URL válida' })
  proofUrl?: string;
}
