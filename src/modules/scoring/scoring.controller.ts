import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { PostDeliveryDto } from './dto/post-delivery.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Scoring Console')
@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  /**
   * Protected: Post a ball-by-ball delivery event
   */
  @Post(':matchId/delivery')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Record a ball delivery with run/extra/wicket calculations' })
  @ApiResponse({ status: 201, description: 'Delivery recorded and broadcasted' })
  @ApiResponse({ status: 400, description: 'Invalid delivery or match state' })
  async postDelivery(
    @Param('matchId') matchId: string,
    @Body() dto: PostDeliveryDto,
    @CurrentUser('id') scorerId: string,
  ) {
    return this.scoringService.postDelivery(matchId, dto, scorerId);
  }

  /**
   * Protected: Undo the last recorded delivery in current innings
   */
  @Post(':matchId/undo')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Undo the last delivery in current innings' })
  @ApiResponse({ status: 200, description: 'Last delivery undone and broadcasted' })
  @ApiResponse({ status: 400, description: 'No delivery to undo' })
  async undoLastDelivery(
    @Param('matchId') matchId: string,
    @CurrentUser('id') scorerId: string,
  ) {
    return this.scoringService.undoLastDelivery(matchId, scorerId);
  }
}

