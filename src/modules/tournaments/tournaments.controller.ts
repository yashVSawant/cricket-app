import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TournamentsService } from './tournaments.service';
import { Public } from '../../common/decorators/public.decorator';

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
}

