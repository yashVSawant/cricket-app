import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveGateway } from '../live/live.gateway';
import { MatchesService } from '../matches/matches.service';
import { PostDeliveryDto } from './dto/post-delivery.dto';
import { ExtraType, MatchStatus } from '@prisma/client';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liveGateway: LiveGateway,
    private readonly matchesService: MatchesService,
  ) {}

  /**
   * Post a single ball delivery with transactional score calculation & Socket.IO broadcast
   */
  async postDelivery(matchId: string, dto: PostDeliveryDto, scorerId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        innings: {
          orderBy: { number: 'desc' },
          take: 1,
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    if (match.status !== MatchStatus.LIVE) {
      throw new BadRequestException('Deliveries can only be entered for matches currently LIVE.');
    }

    if (match.innings.length === 0) {
      throw new BadRequestException('No active innings found for this match.');
    }

    const currentInnings = match.innings[0];

    // Determine whether ball is a legal delivery (Wides and No-balls do not count toward over limit)
    const isLegalBall =
      dto.extraType !== ExtraType.WIDE && dto.extraType !== ExtraType.NO_BALL;

    // Calculate over and ballInOver
    const currentBalls = currentInnings.balls;
    const over = Math.floor(currentBalls / 6);
    const ballInOver = (currentBalls % 6) + (isLegalBall ? 1 : 0);

    const totalRunsThisBall = dto.runsOffBat + (dto.extraRuns || 0);
    const isWicket = !!dto.wicketType;

    // Fetch latest sequence number
    const lastDelivery = await this.prisma.delivery.findFirst({
      where: { inningsId: currentInnings.id },
      orderBy: { seq: 'desc' },
    });
    const nextSeq = (lastDelivery?.seq || 0) + 1;

    // Execute atomic transaction
    const delivery = await this.prisma.$transaction(async (tx) => {
      // 1. Create Delivery record
      const del = await tx.delivery.create({
        data: {
          inningsId: currentInnings.id,
          seq: nextSeq,
          over,
          ballInOver,
          strikerId: dto.strikerId || 'striker-default',
          nonStrikerId: dto.nonStrikerId || 'non-striker-default',
          bowlerId: dto.bowlerId || 'bowler-default',
          runsOffBat: dto.runsOffBat,
          extraType: dto.extraType || ExtraType.NONE,
          extraRuns: dto.extraRuns || 0,
          isFour: dto.isFour || dto.runsOffBat === 4,
          isSix: dto.isSix || dto.runsOffBat === 6,
          wicketType: dto.wicketType || null,
          dismissedId: dto.dismissedId || null,
        },
      });

      // 2. Increment Innings score totals
      const updatedInnings = await tx.innings.update({
        where: { id: currentInnings.id },
        data: {
          runs: { increment: totalRunsThisBall },
          wickets: isWicket ? { increment: 1 } : undefined,
          balls: isLegalBall ? { increment: 1 } : undefined,
        },
      });

      // 3. Check for Innings / Match Completion conditions
      const maxOvers = match.tournament?.oversPerInnings || 20;
      const maxBalls = maxOvers * 6;
      const allOut = updatedInnings.wickets >= 10;
      const oversFinished = updatedInnings.balls >= maxBalls;

      if (currentInnings.number === 1) {
        // If 1st innings finishes, create 2nd innings
        if (allOut || oversFinished) {
          await tx.innings.create({
            data: {
              matchId,
              number: 2,
              battingTeamId: currentInnings.bowlingTeamId,
              bowlingTeamId: currentInnings.battingTeamId,
              runs: 0,
              wickets: 0,
              balls: 0,
            },
          });
        }
      } else if (currentInnings.number === 2) {
        // 2nd Innings Target calculation
        const firstInnings = await tx.innings.findFirst({
          where: { matchId, number: 1 },
        });

        const target = (firstInnings?.runs || 0) + 1;

        if (updatedInnings.runs >= target) {
          // Team batting 2nd wins
          await tx.match.update({
            where: { id: matchId },
            data: {
              status: MatchStatus.COMPLETED,
              result: `Team batting second won by ${10 - updatedInnings.wickets} wickets`,
            },
          });
        } else if (allOut || oversFinished) {
          // Team batting 1st wins or tie
          let resultStr = '';
          if (updatedInnings.runs === target - 1) {
            resultStr = 'Match Tied';
          } else {
            const margin = (firstInnings?.runs || 0) - updatedInnings.runs;
            resultStr = `Team batting first won by ${margin} runs`;
          }

          await tx.match.update({
            where: { id: matchId },
            data: {
              status: MatchStatus.COMPLETED,
              result: resultStr,
            },
          });
        }
      }

      return del;
    });

    // Fetch full updated match
    const updatedMatch = await this.matchesService.findOne(matchId);

    // Real-time Broadcast via Socket.IO
    this.liveGateway.broadcastDeliveryPosted(matchId, {
      match: updatedMatch,
      delivery,
    });

    this.logger.log(`Delivery ${delivery.seq} recorded for match ${matchId} (+${totalRunsThisBall} runs)`);
    return { match: updatedMatch, delivery };
  }

  /**
   * Undo the last ball in current innings with full transactional reversal & broadcast
   */
  async undoLastDelivery(matchId: string, scorerId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        innings: {
          orderBy: { number: 'desc' },
          take: 1,
        },
      },
    });

    if (!match || match.innings.length === 0) {
      throw new NotFoundException('Match or innings not found.');
    }

    const currentInnings = match.innings[0];

    const lastDel = await this.prisma.delivery.findFirst({
      where: { inningsId: currentInnings.id },
      orderBy: { seq: 'desc' },
    });

    if (!lastDel) {
      throw new BadRequestException('No deliveries to undo in current innings.');
    }

    const isLegalBall =
      lastDel.extraType !== ExtraType.WIDE && lastDel.extraType !== ExtraType.NO_BALL;
    const totalRunsThisBall = lastDel.runsOffBat + lastDel.extraRuns;
    const isWicket = !!lastDel.wicketType;

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete delivery record
      await tx.delivery.delete({
        where: { id: lastDel.id },
      });

      // 2. Decrement Innings counters
      await tx.innings.update({
        where: { id: currentInnings.id },
        data: {
          runs: { decrement: totalRunsThisBall },
          wickets: isWicket ? { decrement: 1 } : undefined,
          balls: isLegalBall ? { decrement: 1 } : undefined,
        },
      });

      // 3. Revert match status if it was completed on that ball
      if (match.status === MatchStatus.COMPLETED) {
        await tx.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.LIVE,
            result: null,
          },
        });
      }
    });

    const updatedMatch = await this.matchesService.findOne(matchId);

    // Broadcast Undo via Socket.IO
    this.liveGateway.broadcastDeliveryUndone(matchId, {
      match: updatedMatch,
    });

    this.logger.log(`Undone last delivery (${lastDel.seq}) for match ${matchId}`);
    return { message: 'Last delivery undone successfully', match: updatedMatch };
  }
}

