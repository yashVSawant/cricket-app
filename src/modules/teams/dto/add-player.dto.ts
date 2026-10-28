import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPlayerDto {
  @ApiProperty({ example: 'user-id-to-invite', description: 'User ID of the player to invite' })
  @IsString()
  @IsNotEmpty({ message: 'Player ID is required' })
  playerId: string;
}

