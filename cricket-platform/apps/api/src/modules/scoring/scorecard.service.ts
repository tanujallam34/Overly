import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScorecardDto } from '../matches/dto/match.dto';

@Injectable()
export class ScorecardService {
  constructor(private readonly prisma: PrismaService) {}

  async getScorecard(matchId: string): Promise<ScorecardDto> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        venue: true,
        league: true,
        toss: {
          include: {
            winnerTeam: true,
          },
        },
        innings: {
          include: {
            battingTeam: true,
            bowlingTeam: true,
            ballEvents: {
              include: {
                striker: true,
                nonStriker: true,
                bowler: true,
                wicketEvent: {
                  include: {
                    dismissedPlayer: true,
                  },
                },
              },
              orderBy: { sequenceIndex: 'asc' },
            },
            overs: {
              include: {
                bowler: true,
              },
              orderBy: { number: 'asc' },
            },
          },
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    const scorecard: ScorecardDto = {
      match: {
        id: match.id,
        leagueId: match.leagueId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        venueId: match.venueId,
        startTime: match.startTime,
        format: match.format,
        oversLimit: match.oversLimit,
        ballsPerOver: match.ballsPerOver,
        status: match.status,
        resultType: match.resultType,
        winnerTeamId: match.winnerTeamId,
        winMargin: match.winMargin,
        winType: match.winType,
        targetRuns: match.targetRuns,
        dlsUsed: match.dlsUsed,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      },
      toss: match.toss ? {
        winner: match.toss.winnerTeam.name,
        decision: match.toss.decision,
      } : undefined,
    };

    // Get current innings (last incomplete or last innings)
    const currentInnings = match.innings.find(i => !i.isCompleted) || 
                          match.innings[match.innings.length - 1];

    if (currentInnings) {
      const currentBatsmen = await this.getCurrentBatsmen(currentInnings.id);
      const currentBowler = await this.getCurrentBowler(currentInnings.id);
      const recentOvers = await this.getRecentOvers(currentInnings.id);
      
      const runRate = this.calculateRunRate(currentInnings.totalRuns, Number(currentInnings.totalOvers));
      const requiredRunRate = this.calculateRequiredRunRate(
        currentInnings.targetRuns,
        currentInnings.totalRuns,
        match.oversLimit,
        Number(currentInnings.totalOvers)
      );

      scorecard.currentInnings = {
        id: currentInnings.id,
        number: currentInnings.number,
        battingTeam: {
          id: currentInnings.battingTeam.id,
          name: currentInnings.battingTeam.name,
        },
        bowlingTeam: {
          id: currentInnings.bowlingTeam.id,
          name: currentInnings.bowlingTeam.name,
        },
        totalRuns: currentInnings.totalRuns,
        totalWickets: currentInnings.totalWickets,
        totalOvers: this.formatOvers(Number(currentInnings.totalOvers)),
        extras: currentInnings.extras,
        runRate,
        requiredRunRate,
        targetRuns: currentInnings.targetRuns,
        currentBatsmen,
        currentBowler,
        recentOvers,
      };
    }

    return scorecard;
  }

  private async getCurrentBatsmen(inningsId: string) {
    // Get the last ball to find current batsmen
    const lastBall = await this.prisma.ballEvent.findFirst({
      where: { inningsId },
      orderBy: { sequenceIndex: 'desc' },
      include: {
        striker: true,
        nonStriker: true,
      },
    });

    if (!lastBall) {
      return {
        striker: { id: '', name: '', runs: 0, balls: 0 },
        nonStriker: { id: '', name: '', runs: 0, balls: 0 },
      };
    }

    // Calculate stats for current batsmen
    const strikerStats = await this.getBatsmanStats(inningsId, lastBall.strikerId);
    const nonStrikerStats = await this.getBatsmanStats(inningsId, lastBall.nonStrikerId);

    return {
      striker: {
        id: lastBall.striker.id,
        name: lastBall.striker.name,
        runs: strikerStats.runs,
        balls: strikerStats.balls,
      },
      nonStriker: {
        id: lastBall.nonStriker.id,
        name: lastBall.nonStriker.name,
        runs: nonStrikerStats.runs,
        balls: nonStrikerStats.balls,
      },
    };
  }

  private async getBatsmanStats(inningsId: string, playerId: string) {
    const balls = await this.prisma.ballEvent.findMany({
      where: {
        inningsId,
        strikerId: playerId,
      },
      include: {
        wicketEvent: true,
      },
    });

    let runs = 0;
    let ballsFaced = 0;

    for (const ball of balls) {
      const extras = ball.extras as any || {};
      
      // Only count runs off the bat for batsman's score
      runs += ball.runsOffBat;
      
      // Count balls faced (legal deliveries only)
      if (!extras.wide) {
        ballsFaced++;
      }
    }

    return { runs, balls: ballsFaced };
  }

  private async getCurrentBowler(inningsId: string) {
    const currentOver = await this.prisma.over.findFirst({
      where: { inningsId, isCompleted: false },
      include: {
        bowler: true,
        ballEvents: true,
      },
    });

    if (!currentOver) {
      return {
        id: '',
        name: '',
        overs: '0.0',
        runs: 0,
        wickets: 0,
        economy: 0,
      };
    }

    const bowlerStats = await this.getBowlerStats(inningsId, currentOver.bowlerId);

    return {
      id: currentOver.bowler.id,
      name: currentOver.bowler.name,
      overs: bowlerStats.overs,
      runs: bowlerStats.runs,
      wickets: bowlerStats.wickets,
      economy: bowlerStats.economy,
    };
  }

  private async getBowlerStats(inningsId: string, bowlerId: string) {
    const overs = await this.prisma.over.findMany({
      where: { inningsId, bowlerId },
      include: {
        ballEvents: {
          include: {
            wicketEvent: true,
          },
        },
      },
    });

    let totalRuns = 0;
    let totalWickets = 0;
    let completedOvers = 0;
    let ballsInCurrentOver = 0;

    for (const over of overs) {
      totalRuns += over.runs;
      totalWickets += over.wickets;
      
      if (over.isCompleted) {
        completedOvers++;
      } else {
        ballsInCurrentOver = over.legalBalls;
      }
    }

    const totalOversBowled = completedOvers + (ballsInCurrentOver / 10);
    const economy = totalOversBowled > 0 ? totalRuns / totalOversBowled : 0;

    return {
      overs: this.formatOvers(totalOversBowled),
      runs: totalRuns,
      wickets: totalWickets,
      economy: Number(economy.toFixed(2)),
    };
  }

  private async getRecentOvers(inningsId: string, count: number = 6) {
    const overs = await this.prisma.over.findMany({
      where: { inningsId },
      include: {
        ballEvents: {
          include: {
            wicketEvent: true,
          },
          orderBy: { sequenceIndex: 'asc' },
        },
      },
      orderBy: { number: 'desc' },
      take: count,
    });

    return overs.reverse().map(over => {
      const balls = over.ballEvents.map(ball => {
        const extras = ball.extras as any || {};
        let display = '';

        if (ball.wicketEvent) {
          display = 'W';
        } else if (extras.wide) {
          display = `${ball.runsOffBat}wd`;
        } else if (extras.noBall) {
          display = `${ball.runsOffBat}nb`;
        } else if (ball.boundary === 'four') {
          display = '4';
        } else if (ball.boundary === 'six') {
          display = '6';
        } else {
          display = ball.runsOffBat.toString();
        }

        return display;
      });

      return `${over.number}: ${balls.join(' ')} (${over.runs})`;
    });
  }

  private calculateRunRate(runs: number, overs: number): number {
    if (overs === 0) return 0;
    return Number((runs / overs).toFixed(2));
  }

  private calculateRequiredRunRate(
    target?: number | null,
    currentRuns?: number,
    oversLimit?: number | null,
    oversCompleted?: number
  ): number | undefined {
    if (!target || !oversLimit || oversCompleted === undefined) {
      return undefined;
    }

    const runsRequired = target - (currentRuns || 0);
    const oversRemaining = oversLimit - oversCompleted;

    if (oversRemaining <= 0) return 0;
    
    return Number((runsRequired / oversRemaining).toFixed(2));
  }

  private formatOvers(overs: number): string {
    const completedOvers = Math.floor(overs);
    const balls = Math.round((overs - completedOvers) * 10);
    return `${completedOvers}.${balls}`;
  }
}
