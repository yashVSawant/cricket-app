import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartMatchDto {
  @ApiPropertyOptional({ example: 'team-1-uuid', description: 'Team that won the toss' })
  @IsOptional()
  @IsString()
  tossWonBy?: string;

  @ApiPropertyOptional({ example: 'team-1-uuid', description: 'Team batting first (starts Innings 1)' })
  @IsOptional()
  @IsString()
  battingFirstTeamId?: string;
}

