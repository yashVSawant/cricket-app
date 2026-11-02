import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { StartMatchDto } from './dto/start-match.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

  /**
   * Protected: Organizer schedules a new match between two registered teams
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Schedule a match between two registered teams' })
  @ApiResponse({ status: 201, description: 'Match scheduled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid team or tournament state' })
  async createMatch(
    @Body() dto: CreateMatchDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.matchesService.createMatch(dto, userId);
  }

  /**
   * Protected: Organizer/Scorer starts the match (changes status to LIVE)
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Start a match (status -> LIVE, initializes Innings 1)' })
  @ApiResponse({ status: 200, description: 'Match started and live' })
  @ApiResponse({ status: 400, description: 'Cannot start completed match' })
  async startMatch(
    @Param('id') id: string,
    @Body() dto: StartMatchDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.matchesService.startMatch(id, dto, userId);
  }
}
