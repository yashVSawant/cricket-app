import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token (optional if provided via HTTP-only cookie)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

