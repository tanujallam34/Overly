import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { LeaguesModule } from '../modules/leagues/leagues.module';
import { TeamsModule } from '../modules/teams/teams.module';
import { PlayersModule } from '../modules/players/players.module';
import { VenuesModule } from '../modules/venues/venues.module';
import { MatchesModule } from '../modules/matches/matches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    LeaguesModule,
    TeamsModule,
    PlayersModule,
    VenuesModule,
    MatchesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
