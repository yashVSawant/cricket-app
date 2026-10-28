import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ example: 'Mumbai Titans', description: 'Team name' })
  @IsString()
  @IsNotEmpty({ message: 'Team name is required' })
  @MaxLength(60, { message: 'Team name cannot exceed 60 characters' })
  name: string;

  @ApiPropertyOptional({
    example: ['user-id-1', 'user-id-2'],
    description: 'Array of player user IDs to invite (max 10 additional players)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'You can invite at most 10 additional players (max 11 total including captain)' })
  @IsString({ each: true })
  playerIds?: string[];
}

