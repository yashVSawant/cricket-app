import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'rahul.dravid@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: 'SecureP@ss123', minLength: 6, description: 'User password' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(64, { message: 'Password cannot exceed 64 characters' })
  password: string;

  @ApiProperty({ example: 'Rahul Dravid', description: 'User full name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(80, { message: 'Name cannot exceed 80 characters' })
  name: string;

  @ApiPropertyOptional({
    enum: Role,
    default: Role.PLAYER,
    description: 'User role: PLAYER or ADMIN (Organizer)',
  })
  @IsOptional()
  @IsEnum(Role, { message: 'Role must be either PLAYER or ADMIN' })
  role?: Role = Role.PLAYER;

  // Player Profile fields
  @ApiPropertyOptional({ example: 'Right-hand bat', description: 'Batting style' })
  @IsOptional()
  @IsString()
  battingStyle?: string;

  @ApiPropertyOptional({ example: 'Right-arm medium', description: 'Bowling style' })
  @IsOptional()
  @IsString()
  bowlingStyle?: string;

  // Organizer application fields (if registering as ADMIN)
  @ApiPropertyOptional({ example: 'Karnataka Cricket Association', description: 'Organization name' })
  @IsOptional()
  @IsString()
  organizationName?: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Official state cricket association organizing premier tournaments', description: 'Organization description' })
  @IsOptional()
  @IsString()
  organizationDescription?: string;
}

