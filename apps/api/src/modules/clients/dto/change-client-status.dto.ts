import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ChangeClientStatusDto {
  @ApiProperty({ enum: ClientStatus, example: ClientStatus.SUSPENDED })
  @IsEnum(ClientStatus, { message: 'Estado inválido: ACTIVE, SUSPENDED, CUT o CANCELLED' })
  status!: ClientStatus;

  @ApiPropertyOptional({ description: 'Motivo (obligatorio al suspender, cortar o cancelar)' })
  @ValidateIf((dto: ChangeClientStatusDto) => dto.status !== ClientStatus.ACTIVE)
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio para suspender, cortar o cancelar' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Motivo opcional al reactivar' })
  @IsOptional()
  @IsString()
  reactivationNote?: string;
}
