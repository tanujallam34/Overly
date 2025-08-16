import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Teams Integration Tests', () => {
  let testApp: TestApp;
  let testHelper: TestDataHelper;
  let accessToken: string;
  let organization: any;
  let league: any;
  let user: any;

  beforeAll(async () => {
    testApp = await createTestApp().setup(
      Test.createTestingModule({
        imports: [AppModule],
      })
    );
    testHelper = new TestDataHelper(testApp.prisma);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.cleanup();
    
    // Create organization, league, and user for authentication
    organization = await testHelper.createOrganization();
    league = await testHelper.createLeague(organization.id);
    user = await testHelper.createUser(organization.id);

    // Login to get access token
    const loginResponse = await request(testApp.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password: 'password123',
      });

    accessToken = loginResponse.body.accessToken;
  });

  describe('POST /teams', () => {
    it('should create a new team successfully', async () => {
      const teamData = {
        organizationId: organization.id,
        leagueId: league.id,
        name: 'Test Cricket Club',
        logoUrl: 'https://example.com/logo.png',
      };

      const response = await request(testApp.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        leagueId: league.id,
        name: teamData.name,
        logoUrl: teamData.logoUrl,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should create team without optional fields', async () => {
      const teamData = {
        organizationId: organization.id,
        name: 'Basic Team',
      };

      const response = await request(testApp.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        name: teamData.name,
        leagueId: null,
        logoUrl: null,
      });
    });

    it('should validate required fields', async () => {
      // Missing organizationId
      await request(testApp.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Team',
        })
        .expect(400);

      // Missing name
      await request(testApp.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: organization.id,
        })
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const teamData = {
        organizationId: organization.id,
        name: 'Unauthorized Team',
      };

      await request(testApp.getHttpServer())
        .post('/teams')
        .send(teamData)
        .expect(401);
    });
  });

  describe('GET /teams', () => {
    let anotherOrganization: any;
    let anotherLeague: any;

    beforeEach(async () => {
      anotherOrganization = await testHelper.createOrganization({ name: 'Another Org' });
      anotherLeague = await testHelper.createLeague(organization.id, { name: 'Another League' });
    });

    it('should return all teams', async () => {
      const team1 = await testHelper.createTeam(organization.id, { name: 'Team 1' });
      const team2 = await testHelper.createTeam(organization.id, { name: 'Team 2' });
      const team3 = await testHelper.createTeam(anotherOrganization.id, { name: 'Team 3' });

      const response = await request(testApp.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      
      const teamNames = response.body.map((team: any) => team.name);
      expect(teamNames).toContain('Team 1');
      expect(teamNames).toContain('Team 2');
      expect(teamNames).toContain('Team 3');
    });

    it('should filter teams by organizationId', async () => {
      const team1 = await testHelper.createTeam(organization.id, { name: 'Org1 Team' });
      const team2 = await testHelper.createTeam(anotherOrganization.id, { name: 'Org2 Team' });

      const response = await request(testApp.getHttpServer())
        .get(`/teams?organizationId=${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        name: 'Org1 Team',
        organizationId: organization.id,
      });
    });

    it('should filter teams by leagueId', async () => {
      const team1 = await testHelper.createTeam(organization.id, { 
        name: 'League1 Team', 
        leagueId: league.id 
      });
      const team2 = await testHelper.createTeam(organization.id, { 
        name: 'League2 Team', 
        leagueId: anotherLeague.id 
      });
      const team3 = await testHelper.createTeam(organization.id, { 
        name: 'No League Team' 
      });

      const response = await request(testApp.getHttpServer())
        .get(`/teams?leagueId=${league.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        name: 'League1 Team',
        leagueId: league.id,
      });
    });

    it('should filter teams by both organizationId and leagueId', async () => {
      const team1 = await testHelper.createTeam(organization.id, { 
        name: 'Filtered Team', 
        leagueId: league.id 
      });
      const team2 = await testHelper.createTeam(anotherOrganization.id, { 
        name: 'Different Org Team', 
        leagueId: league.id 
      });

      const response = await request(testApp.getHttpServer())
        .get(`/teams?organizationId=${organization.id}&leagueId=${league.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        name: 'Filtered Team',
        organizationId: organization.id,
        leagueId: league.id,
      });
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .get('/teams')
        .expect(401);
    });
  });

  describe('GET /teams/:id', () => {
    it('should return a specific team', async () => {
      const team = await testHelper.createTeam(organization.id, { 
        name: 'Specific Team',
        leagueId: league.id,
      });

      const response = await request(testApp.getHttpServer())
        .get(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: team.id,
        organizationId: organization.id,
        leagueId: league.id,
        name: 'Specific Team',
      });
    });

    it('should return 404 for non-existent team', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .get(`/teams/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const team = await testHelper.createTeam(organization.id);

      await request(testApp.getHttpServer())
        .get(`/teams/${team.id}`)
        .expect(401);
    });
  });

  describe('PATCH /teams/:id', () => {
    let testTeam: any;

    beforeEach(async () => {
      testTeam = await testHelper.createTeam(organization.id, {
        name: 'Original Team',
        leagueId: league.id,
      });
    });

    it('should update team successfully', async () => {
      const updateData = {
        name: 'Updated Team Name',
        logoUrl: 'https://example.com/new-logo.png',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testTeam.id,
        organizationId: organization.id,
        name: updateData.name,
        logoUrl: updateData.logoUrl,
      });
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        name: 'Partially Updated Team',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.leagueId).toBe(testTeam.leagueId); // Should remain unchanged
    });

    it('should update team league association', async () => {
      const newLeague = await testHelper.createLeague(organization.id, { name: 'New League' });
      const updateData = {
        leagueId: newLeague.id,
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.leagueId).toBe(newLeague.id);
    });

    it('should return 404 for non-existent team', async () => {
      const nonExistentId = 'non-existent-id';
      const updateData = { name: 'Updated Name' };

      await request(testApp.getHttpServer())
        .patch(`/teams/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const updateData = { name: 'Unauthorized Update' };

      await request(testApp.getHttpServer())
        .patch(`/teams/${testTeam.id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('DELETE /teams/:id', () => {
    let testTeam: any;

    beforeEach(async () => {
      testTeam = await testHelper.createTeam(organization.id, {
        name: 'To Be Deleted',
      });
    });

    it('should delete team successfully', async () => {
      await request(testApp.getHttpServer())
        .delete(`/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify team is deleted
      await request(testApp.getHttpServer())
        .get(`/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent team', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .delete(`/teams/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .delete(`/teams/${testTeam.id}`)
        .expect(401);
    });

    it('should handle cascading deletes with players and matches', async () => {
      // Create players and assign them to the team
      const player1 = await testHelper.createPlayer(organization.id, { name: 'Player 1' });
      const player2 = await testHelper.createPlayer(organization.id, { name: 'Player 2' });
      
      await testHelper.assignPlayersToTeam(testTeam.id, [player1.id, player2.id]);

      // Create another team for a match
      const opponent = await testHelper.createTeam(organization.id, { name: 'Opponent' });
      const venue = await testHelper.createVenue(organization.id);
      
      // Create a match with this team
      const match = await testHelper.createMatch(
        league.id,
        testTeam.id,
        opponent.id,
        venue.id
      );

      // Delete team
      await request(testApp.getHttpServer())
        .delete(`/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify team is deleted
      const deletedTeam = await testApp.prisma.team.findUnique({
        where: { id: testTeam.id },
      });
      expect(deletedTeam).toBeNull();

      // Verify team-player associations are deleted
      const teamPlayers = await testApp.prisma.teamPlayer.findMany({
        where: { teamId: testTeam.id },
      });
      expect(teamPlayers.length).toBe(0);

      // Players themselves should still exist
      const existingPlayer = await testApp.prisma.player.findUnique({
        where: { id: player1.id },
      });
      expect(existingPlayer).toBeTruthy();
    });
  });

  describe('Team-Player Integration', () => {
    let testTeam: any;
    let players: any[];

    beforeEach(async () => {
      testTeam = await testHelper.createTeam(organization.id, { name: 'Test Team' });
      players = await Promise.all([
        testHelper.createPlayer(organization.id, { name: 'Player 1' }),
        testHelper.createPlayer(organization.id, { name: 'Player 2' }),
        testHelper.createPlayer(organization.id, { name: 'Player 3' }),
      ]);
    });

    it('should handle team creation and player assignments', async () => {
      // Assign players to team
      await testHelper.assignPlayersToTeam(testTeam.id, players.map(p => p.id));

      // Verify assignments
      const teamPlayers = await testApp.prisma.teamPlayer.findMany({
        where: { teamId: testTeam.id },
        include: { player: true },
      });

      expect(teamPlayers.length).toBe(3);
      const assignedPlayerNames = teamPlayers.map(tp => tp.player.name);
      expect(assignedPlayerNames).toContain('Player 1');
      expect(assignedPlayerNames).toContain('Player 2');
      expect(assignedPlayerNames).toContain('Player 3');
    });

    it('should maintain unique team-player relationships', async () => {
      await testHelper.assignPlayersToTeam(testTeam.id, [players[0].id]);

      // Try to assign the same player again - should handle gracefully
      // Note: This depends on your business logic - might throw error or be ignored
      const duplicate = testApp.prisma.teamPlayer.create({
        data: {
          teamId: testTeam.id,
          playerId: players[0].id,
        },
      });

      await expect(duplicate).rejects.toThrow(); // Should violate unique constraint
    });
  });
});
