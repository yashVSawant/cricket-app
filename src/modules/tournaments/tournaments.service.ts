import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RegisterTeamToTournamentDto } from './dto/register-team.dto';
import { Role } from '@prisma/client';

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public: List tournaments with registration & match counters
   */
  async findAll(status?: string, limit?: number) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const tournaments = await this.prisma.tournament.findMany({
      where,
      take: limit ? Number(limit) : undefined,
      orderBy: { startDate: 'desc' },
      include: {
        organizer: {
          select: { id: true, name: true, contactEmail: true, status: true },
        },
        _count: {
          select: {
            registrations: true,
            matches: true,
          },
        },
      },
    });

    return tournaments.map((t) => ({
      ...t,
      registrationsCount: t._count.registrations,
      matchesCount: t._count.matches,
    }));
  }

  /**
   * Public: Get tournament details including registered teams and matches
   */
  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, name: true, contactEmail: true, status: true },
        },
        registrations: {
          include: {
            team: {
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
            },
          },
        },
        matches: {
          orderBy: { startTime: 'asc' },
          include: {
            innings: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with id ${id} not found`);
    }

    return tournament;
  }

  /**
   * Protected: Organizer creates tournament
   * Enforces:
   * 1. Start date must NOT be less than or equal to today (strictly future date).
   * 2. End date must be on or after start date.
   * 3. User must have an organizer record.
   */
  async create(dto: CreateTournamentDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organizer: true },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    if (!user.organizerId && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'You must have an Organizer account to create tournaments. Please apply or register as an Organizer.',
      );
    }

    // Date Validations
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const today = new Date();
    // Normalize to midnight for accurate day comparison
    today.setHours(0, 0, 0, 0);

    const startMidnight = new Date(start);
    startMidnight.setHours(0, 0, 0, 0);

    if (startMidnight.getTime() <= today.getTime()) {
      throw new BadRequestException(
        'Tournament start date must be in the future (strictly greater than today).',
      );
    }

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('Tournament end date cannot be earlier than start date.');
    }

    // Auto-create or link organizer if needed
    let organizerId = user.organizerId;
    if (!organizerId) {
      const org = await this.prisma.organizer.create({
        data: {
          name: `${user.name}'s Organization`,
          contactEmail: user.email,
          status: 'APPROVED',
        },
      });
      organizerId = org.id;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { organizerId: org.id },
      });
    }

    const tournament = await this.prisma.tournament.create({
      data: {
        organizerId,
        name: dto.name.trim(),
        location: dto.location.trim(),
        startDate: start,
        endDate: end,
        format: dto.format.trim(),
        oversPerInnings: Number(dto.oversPerInnings),
        description: dto.description?.trim() || null,
        status: 'UPCOMING',
      },
      include: {
        organizer: true,
      },
    });

    this.logger.log(`Tournament created: "${tournament.name}" by user ${userId}`);
    return tournament;
  }

  /**
   * Protected: Organizer registers a team to the tournament using Team Key
   * Max 6 teams limit per tournament enforced.
   */
  async registerTeam(tournamentId: string, dto: RegisterTeamToTournamentDto, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with id ${tournamentId} not found`);
    }

    // Max 6 teams limit
    if (tournament.registrations.length >= 6) {
      throw new BadRequestException('Tournament team limit reached (max 6 teams per tournament).');
    }

    const team = await this.prisma.team.findUnique({
      where: { teamKey: dto.teamKey.trim() },
    });

    if (!team) {
      throw new NotFoundException(`No team found with Team Key "${dto.teamKey}"`);
    }

    // Check if team is already registered
    const alreadyRegistered = tournament.registrations.some((r) => r.teamId === team.id);
    if (alreadyRegistered) {
      throw new ConflictException(`Team "${team.name}" is already registered in this tournament.`);
    }

    const registration = await this.prisma.tournamentTeam.create({
      data: {
        tournamentId,
        teamId: team.id,
        displayName: team.name,
      },
      include: {
        team: true,
      },
    });

    this.logger.log(`Team "${team.name}" registered to tournament "${tournament.name}"`);
    return registration;
  }

  /**
   * Protected: Organizer gets tournaments created by them
   */
  async findMyTournaments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.organizerId) {
      return [];
    }

    return this.prisma.tournament.findMany({
      where: { organizerId: user.organizerId },
      orderBy: { startDate: 'desc' },
      include: {
        registrations: {
          include: {
            team: true,
          },
        },
        matches: {
          orderBy: { startTime: 'asc' },
        },
      },
    });
  }
}
