import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, name: true, contactEmail: true, status: true },
        },
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

    if (!tournament) {
      throw new NotFoundException(`Tournament with id ${id} not found`);
    }

    return tournament;
  }
}

