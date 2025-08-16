import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export class TestDataHelper {
  constructor(private prisma: PrismaService) {}

  async createOrganization(data: {
    name?: string;
  } = {}) {
    return this.prisma.organization.create({
      data: {
        name: data.name || 'Test Cricket Association',
      },
    });
  }

  async createUser(organizationId: string, data: {
    email?: string;
    name?: string;
    password?: string;
  } = {}) {
    const hashedPassword = await bcrypt.hash(data.password || 'password123', 10);
    
    return this.prisma.user.create({
      data: {
        email: data.email || `test-${Date.now()}@example.com`,
        name: data.name || 'Test User',
        passwordHash: hashedPassword,
        organizationId,
      },
    });
  }

  async createLeague(organizationId: string, data: {
    name?: string;
    season?: string;
  } = {}) {
    return this.prisma.league.create({
      data: {
        organizationId,
        name: data.name || 'Test League',
        season: data.season || '2024',
      },
    });
  }

  async createTeam(organizationId: string, data: {
    name?: string;
    leagueId?: string;
  } = {}) {
    return this.prisma.team.create({
      data: {
        organizationId,
        name: data.name || `Test Team ${Date.now()}`,
        leagueId: data.leagueId,
      },
    });
  }

  async createPlayer(organizationId: string, data: {
    name?: string;
    battingStyle?: string;
    bowlingStyle?: string;
  } = {}) {
    return this.prisma.player.create({
      data: {
        organizationId,
        name: data.name || `Test Player ${Date.now()}`,
        battingStyle: data.battingStyle || 'Right-hand bat',
        bowlingStyle: data.bowlingStyle || 'Right-arm fast',
      },
    });
  }

  async createVenue(organizationId: string, data: {
    name?: string;
    location?: string;
  } = {}) {
    return this.prisma.venue.create({
      data: {
        organizationId,
        name: data.name || `Test Venue ${Date.now()}`,
        location: data.location || 'Test City',
      },
    });
  }

  async createMatch(
    leagueId: string,
    homeTeamId: string,
    awayTeamId: string,
    venueId: string,
    data: {
      format?: string;
      oversLimit?: number;
      startTime?: Date;
    } = {}
  ) {
    return this.prisma.match.create({
      data: {
        leagueId,
        homeTeamId,
        awayTeamId,
        venueId,
        format: data.format || 'T20',
        oversLimit: data.oversLimit || 20,
        startTime: data.startTime || new Date(),
      },
    });
  }

  async assignPlayersToTeam(teamId: string, playerIds: string[]) {
    const assignments = playerIds.map((playerId, index) => ({
      teamId,
      playerId,
      shirtNumber: index + 1,
    }));

    return this.prisma.teamPlayer.createMany({
      data: assignments,
    });
  }

  // Complete workflow helper
  async createFullTestSetup() {
    const organization = await this.createOrganization();
    
    const [user, league, venue] = await Promise.all([
      this.createUser(organization.id),
      this.createLeague(organization.id),
      this.createVenue(organization.id),
    ]);

    const [homeTeam, awayTeam] = await Promise.all([
      this.createTeam(organization.id, { name: 'Home Team', leagueId: league.id }),
      this.createTeam(organization.id, { name: 'Away Team', leagueId: league.id }),
    ]);

    // Create players for both teams
    const homePlayers = await Promise.all([
      this.createPlayer(organization.id, { name: 'Home Player 1' }),
      this.createPlayer(organization.id, { name: 'Home Player 2' }),
      this.createPlayer(organization.id, { name: 'Home Player 3' }),
      this.createPlayer(organization.id, { name: 'Home Player 4' }),
      this.createPlayer(organization.id, { name: 'Home Player 5' }),
      this.createPlayer(organization.id, { name: 'Home Player 6' }),
      this.createPlayer(organization.id, { name: 'Home Player 7' }),
      this.createPlayer(organization.id, { name: 'Home Player 8' }),
      this.createPlayer(organization.id, { name: 'Home Player 9' }),
      this.createPlayer(organization.id, { name: 'Home Player 10' }),
      this.createPlayer(organization.id, { name: 'Home Player 11' }),
    ]);

    const awayPlayers = await Promise.all([
      this.createPlayer(organization.id, { name: 'Away Player 1' }),
      this.createPlayer(organization.id, { name: 'Away Player 2' }),
      this.createPlayer(organization.id, { name: 'Away Player 3' }),
      this.createPlayer(organization.id, { name: 'Away Player 4' }),
      this.createPlayer(organization.id, { name: 'Away Player 5' }),
      this.createPlayer(organization.id, { name: 'Away Player 6' }),
      this.createPlayer(organization.id, { name: 'Away Player 7' }),
      this.createPlayer(organization.id, { name: 'Away Player 8' }),
      this.createPlayer(organization.id, { name: 'Away Player 9' }),
      this.createPlayer(organization.id, { name: 'Away Player 10' }),
      this.createPlayer(organization.id, { name: 'Away Player 11' }),
    ]);

    // Assign players to teams
    await Promise.all([
      this.assignPlayersToTeam(homeTeam.id, homePlayers.map(p => p.id)),
      this.assignPlayersToTeam(awayTeam.id, awayPlayers.map(p => p.id)),
    ]);

    const match = await this.createMatch(
      league.id,
      homeTeam.id,
      awayTeam.id,
      venue.id
    );

    return {
      organization,
      user,
      league,
      venue,
      homeTeam,
      awayTeam,
      homePlayers,
      awayPlayers,
      match,
    };
  }
}
