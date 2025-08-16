import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { ScoringService } from '../scoring/scoring.service';
import { ScorecardService } from '../scoring/scorecard.service';
import {
  CreateMatchDto,
  TossDto,
  StartInningsDto,
  StartOverDto,
  BallEventDto,
  WicketEventDto,
} from './dto/match.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly scoringService: ScoringService,
    private readonly scorecardService: ScorecardService,
  ) {}

  @Post()
  create(@Body() createMatchDto: CreateMatchDto) {
    return this.matchesService.create(createMatchDto);
  }

  @Get()
  findAll(
    @Query('leagueId') leagueId?: string,
    @Query('status') status?: string,
  ) {
    return this.matchesService.findAll(leagueId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Post(':id/toss')
  @HttpCode(HttpStatus.OK)
  conductToss(@Param('id') id: string, @Body() tossDto: TossDto) {
    return this.matchesService.conductToss(id, tossDto);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  startMatch(@Param('id') id: string) {
    return this.matchesService.startMatch(id);
  }

  @Post(':id/innings/start')
  startInnings(@Param('id') id: string, @Body() startInningsDto: StartInningsDto) {
    return this.matchesService.startInnings(id, startInningsDto);
  }

  @Post('/innings/:inningsId/overs/start')
  startOver(@Param('inningsId') inningsId: string, @Body() startOverDto: StartOverDto) {
    return this.matchesService.startOver(inningsId, startOverDto);
  }

  @Post('/innings/:inningsId/overs/end')
  @HttpCode(HttpStatus.OK)
  endInnings(@Param('inningsId') inningsId: string, @Body() body: { isDeclared?: boolean }) {
    return this.matchesService.endInnings(inningsId, body.isDeclared);
  }

  @Post('/innings/:inningsId/balls')
  recordBall(
    @Param('inningsId') inningsId: string,
    @Body() body: { ball: BallEventDto; wicket?: WicketEventDto },
  ) {
    return this.scoringService.recordBall(inningsId, body.ball, body.wicket);
  }

  @Delete('/innings/:inningsId/balls/last')
  undoLastBall(@Param('inningsId') inningsId: string) {
    return this.scoringService.undoLastBall(inningsId);
  }

  @Get(':id/scorecard')
  getScorecard(@Param('id') id: string) {
    return this.scorecardService.getScorecard(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  completeMatch(
    @Param('id') id: string,
    @Body() body: {
      resultType: string;
      winnerTeamId?: string;
      winMargin?: number;
      winType?: string;
    },
  ) {
    return this.matchesService.completeMatch(
      id,
      body.resultType,
      body.winnerTeamId,
      body.winMargin,
      body.winType,
    );
  }

  @Post(':id/assign')
  assignUser(
    @Param('id') id: string,
    @Body() body: { userId: string; role: string },
  ) {
    return this.matchesService.assignUser(id, body.userId, body.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.matchesService.remove(id);
  }
}
