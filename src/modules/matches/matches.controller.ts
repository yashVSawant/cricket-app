import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { Public } from '../../common/decorators/public.decorator';
import { MatchStatus } from '@prisma/client';

@ApiTags('Matches & Live Scores')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  /**
   * Public: Anyone can view matches and live scores without logging in
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'List matches and live scores (Public - No login required)' })
  @ApiQuery({ name: 'status', required: false, enum: MatchStatus })
  @ApiQuery({ name: 'tournamentId', required: false })
  @ApiResponse({ status: 200, description: 'List of matches with scores' })
  async findAll(
    @Query('status') status?: MatchStatus,
    @Query('tournamentId') tournamentId?: string,
  ) {
    return this.matchesService.findAll(status, tournamentId);
  }

  /**
   * Public: Anyone can view match ball-by-ball details and stats without logging in
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get match ball-by-ball feed and stats (Public - No login required)' })
  @ApiResponse({ status: 200, description: 'Match score details' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  async findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }
}

