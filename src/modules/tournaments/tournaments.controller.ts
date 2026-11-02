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
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RegisterTeamToTournamentDto } from './dto/register-team.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  /**
   * Public: Anyone can view tournaments without logging in
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'List tournaments (Public - No login required)' })
  @ApiQuery({ name: 'status', required: false, description: 'UPCOMING, ONGOING, or COMPLETED' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of results' })
  @ApiResponse({ status: 200, description: 'List of tournaments' })
  async findAll(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.tournamentsService.findAll(status, limit);
  }

  /**
   * Protected: Organizer gets tournaments created by their organization
   */
  @Get('my-tournaments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get tournaments created by current organizer' })
  @ApiResponse({ status: 200, description: 'List of organizer tournaments' })
  async findMyTournaments(@CurrentUser('id') userId: string) {
    return this.tournamentsService.findMyTournaments(userId);
  }

  /**
   * Public: Anyone can view tournament details and schedules without logging in
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get tournament details (Public - No login required)' })
  @ApiResponse({ status: 200, description: 'Tournament details with matches and teams' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  async findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  /**
   * Protected: Organizer creates a new tournament
   * (Enforces start date > today)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a tournament (Organizer only, start date > today)' })
  @ApiResponse({ status: 201, description: 'Tournament created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid dates or payload' })
  async create(
    @Body() dto: CreateTournamentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tournamentsService.create(dto, userId);
  }

  /**
   * Protected: Organizer registers a team to the tournament using Team Key
   */
  @Post(':id/register-team')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register a team to tournament using Team Key (max 6 teams)' })
  @ApiResponse({ status: 201, description: 'Team registered to tournament' })
  @ApiResponse({ status: 400, description: 'Tournament team cap reached or invalid team key' })
  async registerTeam(
    @Param('id') tournamentId: string,
    @Body() dto: RegisterTeamToTournamentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tournamentsService.registerTeam(tournamentId, dto, userId);
  }
}
