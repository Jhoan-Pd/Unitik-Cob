import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

/** Identity document and password are not editable here (auth concerns). */
export class UpdateClientDto extends PartialType(
  OmitType(CreateClientDto, ['documentId', 'password'] as const),
) {}
