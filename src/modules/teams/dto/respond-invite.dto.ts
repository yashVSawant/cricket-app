import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum InviteAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export class RespondInviteDto {
  @ApiProperty({ enum: InviteAction, description: 'ACCEPT or REJECT the team invite' })
  @IsEnum(InviteAction, { message: 'Action must be ACCEPT or REJECT' })
  @IsNotEmpty()
  action: InviteAction;
}

