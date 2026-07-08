import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export const TICKET_CATEGORIES = [
  'INSTALLATION',
  'SUPPORT',
  'BILLING',
  'CANCELLATION',
  'RECONNECTION_COMPLAINT',
] as const;

export class CreateTicketDto {
  @ApiPropertyOptional({
    description: 'Cliente afectado (omitir cuando lo crea el propio cliente desde el portal)',
  })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiProperty({ example: 'Sin servicio desde anoche' })
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  title!: string;

  @ApiProperty({ example: 'El servicio se cae de forma intermitente desde las 8 pm' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  description!: string;

  @ApiProperty({ enum: TICKET_CATEGORIES, example: 'SUPPORT' })
  @IsIn(TICKET_CATEGORIES as unknown as string[], {
    message: `Categoría inválida: ${TICKET_CATEGORIES.join(', ')}`,
  })
  category!: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.MEDIUM })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
