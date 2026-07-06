import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token vigente' })
  @IsJWT({ message: 'El refresh token no es válido' })
  refreshToken!: string;
}
