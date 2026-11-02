import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExtraType, WicketType } from '@prisma/client';

export class PostDeliveryDto {
  @ApiProperty({ example: 4, description: 'Runs scored off the bat (0, 1, 2, 3, 4, 6)' })
  @IsInt()
  @Min(0)
  @Max(6)
  runsOffBat: number;

  @ApiPropertyOptional({ enum: ExtraType, default: ExtraType.NONE, description: 'NONE, WIDE, NO_BALL, BYE, LEG_BYE' })
  @IsOptional()
  @IsEnum(ExtraType)
  extraType?: ExtraType = ExtraType.NONE;

  @ApiPropertyOptional({ example: 1, default: 0, description: 'Extra runs awarded (e.g. 1 for wide/no-ball)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  extraRuns?: number = 0;

  @ApiPropertyOptional({ example: false, description: 'True if ball resulted in a 4' })
  @IsOptional()
  @IsBoolean()
  isFour?: boolean = false;

  @ApiPropertyOptional({ example: false, description: 'True if ball resulted in a 6' })
  @IsOptional()
  @IsBoolean()
  isSix?: boolean = false;

  @ApiPropertyOptional({ enum: WicketType, description: 'Wicket kind if dismissed' })
  @IsOptional()
  @IsEnum(WicketType)
  wicketType?: WicketType;

  @ApiPropertyOptional({ example: 'player-id', description: 'ID of dismissed batsman' })
  @IsOptional()
  @IsString()
  dismissedId?: string;

  @ApiPropertyOptional({ example: 'player-id', description: 'Striker batsman player ID' })
  @IsOptional()
  @IsString()
  strikerId?: string;

  @ApiPropertyOptional({ example: 'player-id', description: 'Non-striker player ID' })
  @IsOptional()
  @IsString()
  nonStrikerId?: string;

  @ApiPropertyOptional({ example: 'player-id', description: 'Bowler player ID' })
  @IsOptional()
  @IsString()
  bowlerId?: string;
}

