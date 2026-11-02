import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchStatus } from '@prisma/client';
import { CreateMatchDto } from './dto/create-match.dto';
import { StartMatchDto } from './dto/start-match.dto';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public: List matches with filter by status or tournamentId
   */
  async findAll(status?: MatchStatus, tournamentId?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    const matches = await this.prisma.match.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: {
        tournament: {
          select: { id: true, name: true, location: true, format: true, oversPerInnings: true, startDate: true },
        },
        innings: {
          orderBy: { number: 'asc' },
        },
      },
    });

    // Populate team names
    const teamIds = new Set<string>();
    matches.forEach((m) => {
      teamIds.add(m.teamAId);
      teamIds.add(m.teamBId);
    });

    const teams = await this.prisma.team.findMany({
      where: { id: { in: Array.from(teamIds) } },
      select: { id: true, name: true, teamKey: true },
    });

    const teamMap = new Map(teams.map((t) => [t.id, t.name]));

    return matches.map((m) => ({
      ...m,
      teamAName: teamMap.get(m.teamAId) || 'Team A',
      teamBName: teamMap.get(m.teamBId) || 'Team B',
    }));
  }

  /**
   * Public: Get match with full innings, live delivery logs, stats & team rosters
   */
  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        tournament: true,
        innings: {
          orderBy: { number: 'asc' },
          include: {
            deliveries: {
              orderBy: { seq: 'desc' },
              take: 36, // Last 6 overs of deliveries
            },
          },
        },
        stats: {
          orderBy: { runs: 'desc' },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    const [teamA, teamB] = await Promise.all([
      this.prisma.team.findUnique({
        where: { id: match.teamAId },
        include: {
          members: {
            where: { status: 'ACCEPTED' },
            include: {
              player: {
                select: { id: true, name: true, email: true, playerKey: true },
              },
            },
          },
        },
      }),
      this.prisma.team.findUnique({
        where: { id: match.teamBId },
        include: {
          members: {
            where: { status: 'ACCEPTED' },
            include: {
              player: {
                select: { id: true, name: true, email: true, playerKey: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      ...match,
      teamA,
      teamB,
      teamAName: teamA?.name || 'Team A',
      teamBName: teamB?.name || 'Team B',
    };
  }

  /**
   * Protected: Organizer schedules a match between two registered teams in the tournament
   */
  async createMatch(dto: CreateMatchDto, userId: string) {
    if (dto.teamAId === dto.teamBId) {
      throw new BadRequestException('A match cannot be played between the same team.');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
      include: {
        registrations: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with id ${dto.tournamentId} not found`);
    }

    // Verify both teams are registered in tournament
    const teamAInTournament = tournament.registrations.some((r) => r.teamId === dto.teamAId);
    const teamBInTournament = tournament.registrations.some((r) => r.teamId === dto.teamBId);

    if (!teamAInTournament || !teamBInTournament) {
      throw new BadRequestException(
        'Both teams must be officially registered in this tournament before scheduling a match.',
      );
    }

    const match = await this.prisma.match.create({
      data: {
        tournamentId: dto.tournamentId,
        teamAId: dto.teamAId,
        teamBId: dto.teamBId,
        venue: dto.venue.trim(),
        startTime: new Date(dto.startTime),
        scorerId: dto.scorerId || userId,
        status: MatchStatus.SCHEDULED,
      },
      include: {
        tournament: true,
      },
    });

    this.logger.log(`Match created: ${dto.teamAId} vs ${dto.teamBId} in tournament ${tournament.name}`);
    return this.findOne(match.id);
  }

  /**
   * Protected: Organizer/Scorer starts the match (status -> LIVE)
   * Initializes 1st Innings
   */
  async startMatch(id: string, dto: StartMatchDto, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        tournament: true,
        innings: true,
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw new BadRequestException('Cannot restart a completed match.');
    }

    // Determine batting & bowling teams for 1st Innings
    const battingTeamId = dto.battingFirstTeamId || match.teamAId;
    const bowlingTeamId = battingTeamId === match.teamAId ? match.teamBId : match.teamAId;

    const updatedMatch = await this.prisma.$transaction(async (tx) => {
      // Update match status to LIVE
      const updated = await tx.match.update({
        where: { id },
        data: {
          status: MatchStatus.LIVE,
          tossWonBy: dto.tossWonBy || null,
        },
      });

      // Update tournament to ONGOING if upcoming
      if (match.tournament.status === 'UPCOMING') {
        await tx.tournament.update({
          where: { id: match.tournamentId },
          data: { status: 'ONGOING' },
        });
      }

      // Initialize Innings 1 if none exists
      if (match.innings.length === 0) {
        await tx.innings.create({
          data: {
            matchId: id,
            number: 1,
            battingTeamId,
            bowlingTeamId,
            runs: 0,
            wickets: 0,
            balls: 0,
          },
        });
      }

      return updated;
    });

    this.logger.log(`Match ${id} started (LIVE) by user ${userId}`);
    return this.findOne(id);
  }
}
