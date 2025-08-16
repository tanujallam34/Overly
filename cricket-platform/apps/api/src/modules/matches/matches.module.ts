import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { ScoringService } from '../scoring/scoring.service';
import { ScorecardService } from '../scoring/scorecard.service';
import { ScoringGateway } from '../scoring/scoring.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MatchesController],
  providers: [MatchesService, ScoringService, ScorecardService, ScoringGateway],
  exports: [MatchesService, ScoringService, ScorecardService, ScoringGateway],
})
export class MatchesModule {}
