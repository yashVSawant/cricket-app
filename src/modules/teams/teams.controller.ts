import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddPlayerDto } from './dto/add-player.dto';
import { RespondInviteDto } from './dto/respond-invite.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Teams & Squads')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * Search registered players by playerKey, name, or email
   */
  @Get('search-players')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Search players by playerKey, name, or email' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Array of matching players' })
  async searchPlayers(
    @Query('q') query: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.teamsService.searchPlayers(query || '', currentUserId);
  }

  /**
   * Create a new team (creator becomes Captain, max 11 players)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new team (Captain only, max 11 players)' })
  @ApiResponse({ status: 201, description: 'Team created successfully with Captain' })
  @ApiResponse({ status: 400, description: 'Validation failed or max 11 players exceeded' })
  async createTeam(
    @Body() dto: CreateTeamDto,
    @CurrentUser('id') captainId: string,
  ) {
    return this.teamsService.createTeam(dto, captainId);
  }

  /**
   * List all teams the current user captains or plays for
   */
  @Get('my-teams')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all teams where user is captain or member' })
  @ApiResponse({ status: 200, description: 'List of user teams' })
  async getMyTeams(@CurrentUser('id') userId: string) {
    return this.teamsService.getMyTeams(userId);
  }

  /**
   * View team details and roster (Public)
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get team details and roster (Public)' })
  @ApiResponse({ status: 200, description: 'Team details with members' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeamById(@Param('id') id: string) {
    return this.teamsService.getTeamById(id);
  }

  /**
   * Captain invites a player to the team (added as INVITED / pending)
   */
  @Post(':id/players')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Captain invites a player (added as inactive/invited)' })
  @ApiResponse({ status: 200, description: 'Player invited to team' })
  @ApiResponse({ status: 403, description: 'Only Captain can invite players' })
  @ApiResponse({ status: 400, description: 'Team is full (max 11 players)' })
  async addPlayer(
    @Param('id') teamId: string,
    @Body() dto: AddPlayerDto,
    @CurrentUser('id') captainId: string,
  ) {
    return this.teamsService.addPlayer(teamId, dto.playerId, captainId);
  }

  /**
   * Captain removes an invited or active player from the team
   */
  @Delete(':id/players/:playerId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Captain removes a player from the team' })
  @ApiResponse({ status: 200, description: 'Player removed successfully' })
  @ApiResponse({ status: 403, description: 'Only Captain can remove players' })
  async removePlayer(
    @Param('id') teamId: string,
    @Param('playerId') playerId: string,
    @CurrentUser('id') captainId: string,
  ) {
    return this.teamsService.removePlayer(teamId, playerId, captainId);
  }

  /**
   * Player accepts or declines a team invitation
   */
  @Post(':id/respond-invite')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Player accepts or declines team invitation' })
  @ApiResponse({ status: 200, description: 'Invitation response recorded' })
  @ApiResponse({ status: 404, description: 'No pending invitation found' })
  async respondInvite(
    @Param('id') teamId: string,
    @Body() dto: RespondInviteDto,
    @CurrentUser('id') playerId: string,
  ) {
    return this.teamsService.respondInvite(teamId, playerId, dto.action);
  }
}

