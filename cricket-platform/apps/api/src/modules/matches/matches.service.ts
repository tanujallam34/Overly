import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMatchDto, TossDto, StartInningsDto, StartOverDto } from './dto/match.dto';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMatchDto: CreateMatchDto) {
    const { startTime, ...data } = createMatchDto;
    
    return this.prisma.match.create({
      data: {
        ...data,
        startTime: new Date(startTime),
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        venue: true,
        league: true,
      },
    });
  }

  async findAll(leagueId?: string, status?: string) {
    const where: any = {};
    if (leagueId) where.leagueId = leagueId;
    if (status) where.status = status;

    return this.prisma.match.findMany({
      where,
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
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
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
            overs: {
              include: {
                bowler: true,
              },
              orderBy: { number: 'desc' },
              take: 1,
            },
            ballEvents: {
              orderBy: { sequenceIndex: 'desc' },
              take: 6,
              include: {
                striker: true,
                nonStriker: true,
                bowler: true,
                wicketEvent: {
                  include: {
                    dismissedPlayer: true,
                    bowler: true,
                    fielder: true,
                  },
                },
              },
            },
          },
          orderBy: { number: 'asc' },
        },
        assignments: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return match;
  }

  async conductToss(matchId: string, tossDto: TossDto) {
    const match = await this.findOne(matchId);
    
    if (match.status !== 'scheduled') {
      throw new BadRequestException('Toss can only be conducted for scheduled matches');
    }

    if (match.toss) {
      throw new BadRequestException('Toss has already been conducted');
    }

    // Verify the winner team is one of the playing teams
    if (tossDto.winnerTeamId !== match.homeTeamId && tossDto.winnerTeamId !== match.awayTeamId) {
      throw new BadRequestException('Winner team must be one of the playing teams');
    }

    return this.prisma.toss.create({
      data: {
        matchId,
        winnerTeamId: tossDto.winnerTeamId,
        decision: tossDto.decision,
      },
      include: {
        winnerTeam: true,
        match: true,
      },
    });
  }

  async startMatch(matchId: string) {
    const match = await this.findOne(matchId);
    
    if (match.status !== 'scheduled') {
      throw new BadRequestException('Only scheduled matches can be started');
    }

    if (!match.toss) {
      throw new BadRequestException('Toss must be conducted before starting the match');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'live' },
      include: {
        homeTeam: true,
        awayTeam: true,
        venue: true,
        toss: {
          include: {
            winnerTeam: true,
          },
        },
      },
    });
  }

  async startInnings(matchId: string, startInningsDto: StartInningsDto) {
    const match = await this.findOne(matchId);
    
    if (match.status !== 'live') {
      throw new BadRequestException('Match must be live to start an innings');
    }

    // Determine innings number
    const existingInnings = await this.prisma.innings.count({
      where: { matchId },
    });

    const inningsNumber = existingInnings + 1;
    
    // Validate innings number based on format
    const maxInnings = match.format === 'Test' ? 4 : 2;
    if (inningsNumber > maxInnings) {
      throw new BadRequestException(`Cannot start innings ${inningsNumber} for ${match.format} format`);
    }

    // Verify teams are playing teams
    const validTeamIds = [match.homeTeamId, match.awayTeamId];
    if (!validTeamIds.includes(startInningsDto.battingTeamId) || 
        !validTeamIds.includes(startInningsDto.bowlingTeamId)) {
      throw new BadRequestException('Invalid team selection');
    }

    if (startInningsDto.battingTeamId === startInningsDto.bowlingTeamId) {
      throw new BadRequestException('Batting and bowling teams must be different');
    }

    return this.prisma.innings.create({
      data: {
        matchId,
        number: inningsNumber,
        battingTeamId: startInningsDto.battingTeamId,
        bowlingTeamId: startInningsDto.bowlingTeamId,
        targetRuns: startInningsDto.targetRuns,
      },
      include: {
        match: true,
        battingTeam: true,
        bowlingTeam: true,
      },
    });
  }

  async startOver(inningsId: string, startOverDto: StartOverDto) {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: {
        match: true,
        overs: {
          orderBy: { number: 'desc' },
          take: 1,
        },
      },
    });

    if (!innings) {
      throw new NotFoundException('Innings not found');
    }

    if (innings.isCompleted) {
      throw new BadRequestException('Cannot start over in completed innings');
    }

    // Determine over number
    const lastOver = innings.overs[0];
    const overNumber = lastOver ? lastOver.number + 1 : 1;

    // Check over limit
    if (innings.match.oversLimit && overNumber > innings.match.oversLimit) {
      throw new BadRequestException(`Cannot exceed ${innings.match.oversLimit} overs limit`);
    }

    // Check if previous over is completed
    if (lastOver && !lastOver.isCompleted) {
      throw new BadRequestException('Previous over must be completed before starting new over');
    }

    return this.prisma.over.create({
      data: {
        inningsId,
        number: overNumber,
        bowlerId: startOverDto.bowlerId,
      },
      include: {
        bowler: true,
        innings: {
          include: {
            match: true,
          },
        },
      },
    });
  }

  async endInnings(inningsId: string, isDeclared: boolean = false) {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: {
        match: true,
      },
    });

    if (!innings) {
      throw new NotFoundException('Innings not found');
    }

    if (innings.isCompleted) {
      throw new BadRequestException('Innings is already completed');
    }

    return this.prisma.innings.update({
      where: { id: inningsId },
      data: {
        isCompleted: true,
        isDeclared,
      },
      include: {
        match: true,
        battingTeam: true,
        bowlingTeam: true,
      },
    });
  }

  async completeMatch(matchId: string, resultType: string, winnerTeamId?: string, winMargin?: number, winType?: string) {
    const match = await this.findOne(matchId);
    
    if (match.status !== 'live') {
      throw new BadRequestException('Only live matches can be completed');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'completed',
        resultType,
        winnerTeamId,
        winMargin,
        winType,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        venue: true,
        winner: true,
        innings: {
          include: {
            battingTeam: true,
            bowlingTeam: true,
          },
        },
      },
    });
  }

  async assignUser(matchId: string, userId: string, role: string) {
    const match = await this.findOne(matchId);
    
    if (match.status === 'completed') {
      throw new BadRequestException('Cannot assign users to completed matches');
    }

    return this.prisma.assignment.create({
      data: {
        matchId,
        userId,
        role,
      },
      include: {
        user: true,
        match: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists
    return this.prisma.match.delete({
      where: { id },
    });
  }
}
