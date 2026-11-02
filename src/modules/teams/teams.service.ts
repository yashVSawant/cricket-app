import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { InviteAction } from './dto/respond-invite.dto';
import { MemberStatus } from '@prisma/client';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);
  private readonly MAX_TEAM_SIZE = 11;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search registered players by playerKey, name, or email
   */
  async searchPlayers(query: string, currentUserId: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim();

    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId }, // Exclude captain from search results
        role: 'PLAYER',
        OR: [
          { playerKey: { contains: cleanQuery, mode: 'insensitive' } },
          { name: { contains: cleanQuery, mode: 'insensitive' } },
          { email: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        playerKey: true,
        playerProfile: {
          select: {
            battingStyle: true,
            bowlingStyle: true,
          },
        },
      },
      take: 10,
    });
  }

  /**
   * Create a new team. Creator automatically becomes Captain.
   * Optional initial player IDs are added as INVITED. Max 11 players.
   */
  async createTeam(dto: CreateTeamDto, captainId: string) {
    const invitePlayerIds = Array.from(new Set(dto.playerIds || [])).filter(
      (id) => id !== captainId,
    );

    // Enforce max 11 players (captain + up to 10 invites)
    if (1 + invitePlayerIds.length > this.MAX_TEAM_SIZE) {
      throw new BadRequestException(
        `A team can have a maximum of ${this.MAX_TEAM_SIZE} players (1 Captain + up to 10 members).`,
      );
    }

    const teamKey = `TM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const team = await this.prisma.$transaction(async (tx) => {
      // 1. Create Team record
      const newTeam = await tx.team.create({
        data: {
          name: dto.name.trim(),
          teamKey,
          captainId,
        },
      });

      // 2. Add Captain as ACCEPTED (active) member
      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          playerId: captainId,
          status: MemberStatus.ACCEPTED,
        },
      });

      // 3. Add invited players as INVITED (inactive / pending)
      if (invitePlayerIds.length > 0) {
        await tx.teamMember.createMany({
          data: invitePlayerIds.map((playerId) => ({
            teamId: newTeam.id,
            playerId,
            status: MemberStatus.INVITED,
          })),
          skipDuplicates: true,
        });
      }

      return newTeam;
    });

    this.logger.log(`Team created: "${team.name}" [${team.teamKey}] by captain ${captainId}`);
    return this.getTeamById(team.id);
  }

  /**
   * Get team details with all members and invitation status
   */
  async getTeamById(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                email: true,
                playerKey: true,
                playerProfile: {
                  select: {
                    battingStyle: true,
                    bowlingStyle: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    const captain = await this.prisma.user.findUnique({
      where: { id: team.captainId },
      select: { id: true, name: true, email: true, playerKey: true },
    });

    return {
      ...team,
      captain,
      activeMemberCount: team.members.filter((m) => m.status === MemberStatus.ACCEPTED).length,
      invitedMemberCount: team.members.filter((m) => m.status === MemberStatus.INVITED).length,
      totalMemberCount: team.members.length,
      maxAllowed: this.MAX_TEAM_SIZE,
    };
  }

  /**
   * Get all teams where current user is captain or member
   */
  async getMyTeams(userId: string) {
    return this.prisma.team.findMany({
      where: {
        OR: [
          { captainId: userId },
          { members: { some: { playerId: userId } } },
        ],
      },
      include: {
        members: {
          include: {
            player: {
              select: { id: true, name: true, email: true, playerKey: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Captain invites a player to the team (added as INVITED / inactive)
   */
  async addPlayer(teamId: string, playerId: string, captainId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Only Captain can add players
    if (team.captainId !== captainId) {
      throw new ForbiddenException('Only the team captain can add or invite players to this team.');
    }

    // Check max capacity (11 players total)
    if (team.members.length >= this.MAX_TEAM_SIZE) {
      throw new BadRequestException(
        `Team has reached the maximum allowed limit of ${this.MAX_TEAM_SIZE} players.`,
      );
    }

    // Check if player is already invited or in team
    const existing = team.members.find((m) => m.playerId === playerId);
    if (existing) {
      throw new ConflictException(
        existing.status === MemberStatus.ACCEPTED
          ? 'This player is already an active member of the team.'
          : 'This player has already been invited and the invitation is pending.',
      );
    }

    // Verify player exists
    const player = await this.prisma.user.findUnique({
      where: { id: playerId },
    });
    if (!player) {
      throw new NotFoundException('Player account not found');
    }

    // Add player with INVITED status
    await this.prisma.teamMember.create({
      data: {
        teamId,
        playerId,
        status: MemberStatus.INVITED,
      },
    });

    this.logger.log(`Player ${player.email} invited to team "${team.name}" by captain`);
    return this.getTeamById(teamId);
  }

  /**
   * Captain removes a player from the team
   */
  async removePlayer(teamId: string, playerId: string, captainId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Only Captain can remove players
    if (team.captainId !== captainId) {
      throw new ForbiddenException('Only the team captain can remove players from this team.');
    }

    // Captain cannot be removed
    if (playerId === captainId) {
      throw new BadRequestException('The team captain cannot be removed from the team.');
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_playerId: { teamId, playerId },
      },
    });

    if (!membership) {
      throw new NotFoundException('This player is not a member of the team.');
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_playerId: { teamId, playerId },
      },
    });

    this.logger.log(`Player ${playerId} removed from team "${team.name}" by captain`);
    return { message: 'Player removed from team successfully' };
  }

  /**
   * Invited player accepts or declines team invitation
   */
  async respondInvite(teamId: string, playerId: string, action: InviteAction) {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_playerId: { teamId, playerId },
      },
      include: {
        team: { select: { name: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException('No team invitation found for this account.');
    }

    if (action === InviteAction.ACCEPT) {
      await this.prisma.teamMember.update({
        where: { teamId_playerId: { teamId, playerId } },
        data: { status: MemberStatus.ACCEPTED },
      });

      return {
        message: `You are now an active player in team "${membership.team.name}"!`,
        status: MemberStatus.ACCEPTED,
      };
    } else {
      await this.prisma.teamMember.delete({
        where: { teamId_playerId: { teamId, playerId } },
      });

      return {
        message: `You have declined the invitation to join team "${membership.team.name}".`,
        status: MemberStatus.REJECTED,
      };
    }
  }
}

