import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTournamentDto {
  @ApiProperty({ example: 'National Premier League 2026', description: 'Tournament name' })
  @IsString()
  @IsNotEmpty({ message: 'Tournament name is required' })
  @MaxLength(100, { message: 'Tournament name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({ example: 'Wankhede Stadium, Mumbai', description: 'Tournament location / venue' })
  @IsString()
  @IsNotEmpty({ message: 'Location is required' })
  @MaxLength(120, { message: 'Location cannot exceed 120 characters' })
  location: string;

  @ApiProperty({ example: '2026-11-15', description: 'Start date (must be strictly after today)' })
  @IsDateString({}, { message: 'Valid start date (YYYY-MM-DD) is required' })
  @IsNotEmpty({ message: 'Start date is required' })
  startDate: string;

  @ApiProperty({ example: '2026-11-25', description: 'End date (must be equal or after start date)' })
  @IsDateString({}, { message: 'Valid end date (YYYY-MM-DD) is required' })
  @IsNotEmpty({ message: 'End date is required' })
  endDate: string;

  @ApiProperty({ example: 'T20', description: 'Format: T20, T10, or ODI' })
  @IsString()
  @IsNotEmpty({ message: 'Format is required' })
  format: string;

  @ApiProperty({ example: 20, description: 'Overs per innings (e.g. 20 for T20, 10 for T10)' })
  @IsInt()
  @Min(5, { message: 'Minimum 5 overs per innings' })
  @Max(50, { message: 'Maximum 50 overs per innings' })
  oversPerInnings: number;

  @ApiPropertyOptional({ example: 'Premier annual state cricket championship.', description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;
}

