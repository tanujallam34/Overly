import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BallEventDto, WicketEventDto } from '../matches/dto/match.dto';

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBall(inningsId: string, ballEventDto: BallEventDto, wicketEventDto?: WicketEventDto) {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: {
        match: true,
        overs: {
          where: { isCompleted: false },
          orderBy: { number: 'desc' },
          take: 1,
        },
        ballEvents: {
          orderBy: { sequenceIndex: 'desc' },
          take: 1,
        },
      },
    });

    if (!innings) {
      throw new NotFoundException('Innings not found');
    }

    if (innings.isCompleted) {
      throw new BadRequestException('Cannot record balls in completed innings');
    }

    const currentOver = innings.overs[0];
    if (!currentOver) {
      throw new BadRequestException('No active over found. Start an over first.');
    }

    if (currentOver.isCompleted) {
      throw new BadRequestException('Current over is completed. Start a new over.');
    }

    // Calculate sequence index
    const lastBall = innings.ballEvents[0];
    const sequenceIndex = lastBall ? lastBall.sequenceIndex + 1 : 1;

    // Calculate ball number (only legal deliveries count)
    const extras = ballEventDto.extras || {};
    const isLegalDelivery = !extras.wide && !extras.noBall;
    
    let ballNumber = 1;
    if (lastBall && lastBall.overNumber === currentOver.number) {
      if (isLegalDelivery) {
        // Count legal balls in this over
        const legalBallsInOver = await this.prisma.ballEvent.count({
          where: {
            inningsId,
            overNumber: currentOver.number,
            extras: {
              path: ['wide'],
              equals: 0,
            },
          },
        });
        ballNumber = legalBallsInOver + 1;
      } else {
        ballNumber = lastBall.ballNumber;
      }
    }

    // Check if over should be completed
    const maxBalls = innings.match.ballsPerOver;
    if (ballNumber > maxBalls) {
      throw new BadRequestException(`Over cannot exceed ${maxBalls} balls`);
    }

    // Calculate total runs for this ball
    const totalRuns = ballEventDto.runsOffBat + 
                     (extras.wide || 0) + 
                     (extras.noBall || 0) + 
                     (extras.bye || 0) + 
                     (extras.legBye || 0) + 
                     (extras.penalty || 0);

    // Create ball event
    const ballEvent = await this.prisma.ballEvent.create({
      data: {
        inningsId,
        overNumber: currentOver.number,
        ballNumber,
        sequenceIndex,
        strikerId: ballEventDto.strikerId,
        nonStrikerId: ballEventDto.nonStrikerId,
        bowlerId: ballEventDto.bowlerId,
        runsOffBat: ballEventDto.runsOffBat,
        extras: extras,
        boundary: ballEventDto.boundary,
        freeHit: ballEventDto.freeHit || false,
        commentary: ballEventDto.commentary,
      },
      include: {
        striker: true,
        nonStriker: true,
        bowler: true,
        innings: {
          include: {
            match: true,
          },
        },
      },
    });

    // Create wicket event if provided
    let wicketEvent = null;
    if (wicketEventDto) {
      wicketEvent = await this.prisma.wicketEvent.create({
        data: {
          ballEventId: ballEvent.id,
          inningsId,
          type: wicketEventDto.type,
          dismissedPlayerId: wicketEventDto.dismissedPlayerId,
          bowlerId: wicketEventDto.bowlerId,
          fielderId: wicketEventDto.fielderId,
          runOutEnd: wicketEventDto.runOutEnd,
          battersCrossed: wicketEventDto.battersCrossed || false,
        },
        include: {
          dismissedPlayer: true,
          bowler: true,
          fielder: true,
        },
      });
    }

    // Update over statistics
    await this.updateOverStats(currentOver.id);

    // Update innings statistics
    await this.updateInningsStats(inningsId);

    // Check if over is completed
    if (isLegalDelivery && ballNumber === maxBalls) {
      await this.prisma.over.update({
        where: { id: currentOver.id },
        data: { isCompleted: true },
      });
    }

    // Check if innings should be completed
    await this.checkInningsCompletion(inningsId);

    return {
      ballEvent: {
        ...ballEvent,
        wicketEvent,
      },
      overCompleted: isLegalDelivery && ballNumber === maxBalls,
    };
  }

  private async updateOverStats(overId: string) {
    const over = await this.prisma.over.findUnique({
      where: { id: overId },
      include: {
        ballEvents: {
          include: {
            wicketEvent: true,
          },
        },
      },
    });

    if (!over) return;

    let runs = 0;
    let wickets = 0;
    let extras = 0;
    let legalBalls = 0;

    for (const ball of over.ballEvents) {
      const ballExtras = ball.extras as any || {};
      const ballRuns = ball.runsOffBat + 
                      (ballExtras.wide || 0) + 
                      (ballExtras.noBall || 0) + 
                      (ballExtras.bye || 0) + 
                      (ballExtras.legBye || 0) + 
                      (ballExtras.penalty || 0);
      
      runs += ballRuns;
      extras += (ballExtras.wide || 0) + (ballExtras.noBall || 0) + 
                (ballExtras.bye || 0) + (ballExtras.legBye || 0) + 
                (ballExtras.penalty || 0);
      
      if (ball.wicketEvent) {
        wickets++;
      }

      // Count legal balls (not wide or no-ball)
      if (!ballExtras.wide && !ballExtras.noBall) {
        legalBalls++;
      }
    }

    await this.prisma.over.update({
      where: { id: overId },
      data: {
        runs,
        wickets,
        extras,
        legalBalls,
      },
    });
  }

  private async updateInningsStats(inningsId: string) {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: {
        ballEvents: {
          include: {
            wicketEvent: true,
          },
        },
        overs: true,
      },
    });

    if (!innings) return;

    let totalRuns = 0;
    let totalWickets = 0;
    let extras = 0;

    for (const ball of innings.ballEvents) {
      const ballExtras = ball.extras as any || {};
      const ballRuns = ball.runsOffBat + 
                      (ballExtras.wide || 0) + 
                      (ballExtras.noBall || 0) + 
                      (ballExtras.bye || 0) + 
                      (ballExtras.legBye || 0) + 
                      (ballExtras.penalty || 0);
      
      totalRuns += ballRuns;
      extras += (ballExtras.wide || 0) + (ballExtras.noBall || 0) + 
                (ballExtras.bye || 0) + (ballExtras.legBye || 0) + 
                (ballExtras.penalty || 0);
      
      if (ball.wicketEvent) {
        totalWickets++;
      }
    }

    // Calculate total overs (completed overs + current over progress)
    const completedOvers = innings.overs.filter(o => o.isCompleted).length;
    const currentOver = innings.overs.find(o => !o.isCompleted);
    const currentOverProgress = currentOver ? currentOver.legalBalls : 0;
    const totalOvers = completedOvers + (currentOverProgress / 10);

    await this.prisma.innings.update({
      where: { id: inningsId },
      data: {
        totalRuns,
        totalWickets,
        totalOvers,
        extras,
      },
    });
  }

  private async checkInningsCompletion(inningsId: string) {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: {
        match: true,
        overs: true,
      },
    });

    if (!innings) return;

    let shouldComplete = false;
    
    // Check if all wickets are down (10 wickets in most formats)
    if (innings.totalWickets >= 10) {
      shouldComplete = true;
    }

    // Check if over limit reached
    if (innings.match.oversLimit) {
      const completedOvers = innings.overs.filter(o => o.isCompleted).length;
      if (completedOvers >= innings.match.oversLimit) {
        shouldComplete = true;
      }
    }

    // Check if target is reached (for chase innings)
    if (innings.targetRuns && innings.totalRuns >= innings.targetRuns) {
      shouldComplete = true;
    }

    if (shouldComplete && !innings.isCompleted) {
      await this.prisma.innings.update({
        where: { id: inningsId },
        data: { isCompleted: true },
      });
    }
  }

  async undoLastBall(inningsId: string) {
    const lastBall = await this.prisma.ballEvent.findFirst({
      where: { inningsId },
      orderBy: { sequenceIndex: 'desc' },
      include: {
        wicketEvent: true,
        over: true,
      },
    });

    if (!lastBall) {
      throw new NotFoundException('No balls to undo');
    }

    // Delete wicket event if exists
    if (lastBall.wicketEvent) {
      await this.prisma.wicketEvent.delete({
        where: { id: lastBall.wicketEvent.id },
      });
    }

    // Delete ball event
    await this.prisma.ballEvent.delete({
      where: { id: lastBall.id },
    });

    // Reopen over if it was completed
    if (lastBall.over.isCompleted) {
      await this.prisma.over.update({
        where: { id: lastBall.over.id },
        data: { isCompleted: false },
      });
    }

    // Update over and innings statistics
    await this.updateOverStats(lastBall.over.id);
    await this.updateInningsStats(inningsId);

    return { message: 'Last ball undone successfully' };
  }
}
