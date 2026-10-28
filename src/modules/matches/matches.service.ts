import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchStatus } from '@prisma/client';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: MatchStatus, tournamentId?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    return this.prisma.match.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: {
        tournament: {
          select: { id: true, name: true, location: true, format: true },
        },
        innings: {
          orderBy: { number: 'asc' },
        },
      },
    });
  }

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
              take: 20,
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

    return match;
  }
}

