import { IsString, IsOptional, IsDateString, IsInt, IsBoolean, IsIn, Min, Max } from 'class-validator';

export class CreateMatchDto {
  @IsString()
  @IsOptional()
  leagueId?: string;

  @IsString()
  homeTeamId: string;

  @IsString()
  awayTeamId: string;

  @IsString()
  venueId: string;

  @IsDateString()
  startTime: string;

  @IsString()
  @IsIn(['T20', 'ODI', 'Test', 'T10', 'Custom'])
  format: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  oversLimit?: number;

  @IsInt()
  @Min(4)
  @Max(8)
  @IsOptional()
  ballsPerOver?: number = 6;

  @IsString()
  @IsOptional()
  rulesetId?: string;
}

export class TossDto {
  @IsString()
  winnerTeamId: string;

  @IsString()
  @IsIn(['bat', 'bowl'])
  decision: string;
}

export class BallEventDto {
  @IsString()
  strikerId: string;

  @IsString()
  nonStrikerId: string;

  @IsString()
  bowlerId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  runsOffBat: number;

  @IsOptional()
  extras?: {
    wide?: number;
    noBall?: number;
    bye?: number;
    legBye?: number;
    penalty?: number;
  };

  @IsString()
  @IsOptional()
  @IsIn(['four', 'six'])
  boundary?: string;

  @IsBoolean()
  @IsOptional()
  freeHit?: boolean = false;

  @IsString()
  @IsOptional()
  commentary?: string;
}

export class WicketEventDto {
  @IsString()
  @IsIn(['bowled', 'caught', 'lbw', 'runOut', 'stumped', 'hitWicket', 'handledBall', 'timedOut', 'retiredOut'])
  type: string;

  @IsString()
  dismissedPlayerId: string;

  @IsString()
  @IsOptional()
  bowlerId?: string;

  @IsString()
  @IsOptional()
  fielderId?: string;

  @IsString()
  @IsOptional()
  @IsIn(['striker', 'nonStriker'])
  runOutEnd?: string;

  @IsBoolean()
  @IsOptional()
  battersCrossed?: boolean = false;
}

export class StartInningsDto {
  @IsString()
  battingTeamId: string;

  @IsString()
  bowlingTeamId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  targetRuns?: number;
}

export class StartOverDto {
  @IsString()
  bowlerId: string;
}

export class MatchResponseDto {
  id: string;
  leagueId?: string;
  homeTeamId: string;
  awayTeamId: string;
  venueId: string;
  startTime: Date;
  format: string;
  oversLimit?: number;
  ballsPerOver: number;
  status: string;
  resultType?: string;
  winnerTeamId?: string;
  winMargin?: number;
  winType?: string;
  targetRuns?: number;
  dlsUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ScorecardDto {
  match: MatchResponseDto;
  currentInnings?: {
    id: string;
    number: number;
    battingTeam: { id: string; name: string };
    bowlingTeam: { id: string; name: string };
    totalRuns: number;
    totalWickets: number;
    totalOvers: string; // "19.4"
    extras: number;
    runRate: number;
    requiredRunRate?: number;
    targetRuns?: number;
    currentBatsmen: {
      striker: { id: string; name: string; runs: number; balls: number };
      nonStriker: { id: string; name: string; runs: number; balls: number };
    };
    currentBowler: {
      id: string;
      name: string;
      overs: string;
      runs: number;
      wickets: number;
      economy: number;
    };
    recentOvers: string[];
  };
  toss?: {
    winner: string;
    decision: string;
  };
}
