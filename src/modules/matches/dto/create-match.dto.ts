import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMatchDto {
  @ApiProperty({ example: 'tourn-id-uuid', description: 'Tournament ID' })
  @IsString()
  @IsNotEmpty({ message: 'Tournament ID is required' })
  tournamentId: string;

  @ApiProperty({ example: 'team-1-uuid', description: 'Team A ID (must be registered in tournament)' })
  @IsString()
  @IsNotEmpty({ message: 'Team A is required' })
  teamAId: string;

  @ApiProperty({ example: 'team-2-uuid', description: 'Team B ID (must be registered in tournament)' })
  @IsString()
  @IsNotEmpty({ message: 'Team B is required' })
  teamBId: string;

  @ApiProperty({ example: 'Wankhede Stadium, Mumbai', description: 'Match venue' })
  @IsString()
  @IsNotEmpty({ message: 'Venue is required' })
  venue: string;

  @ApiProperty({ example: '2026-11-16T14:00:00Z', description: 'Scheduled match start time' })
  @IsDateString({}, { message: 'Valid start time is required' })
  @IsNotEmpty()
  startTime: string;

  @ApiPropertyOptional({ example: 'scorer-user-id', description: 'Assigned Scorer ID' })
  @IsOptional()
  @IsString()
  scorerId?: string;
}

