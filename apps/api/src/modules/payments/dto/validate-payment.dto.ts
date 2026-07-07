import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class ValidatePaymentDto {
  @ApiProperty({ description: 'true = aprobar, false = rechazar comprobante' })
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional({ description: 'Motivo del rechazo (obligatorio al rechazar)' })
  @ValidateIf((dto: ValidatePaymentDto) => dto.approve === false)
  @IsString()
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
  reason?: string;
}
