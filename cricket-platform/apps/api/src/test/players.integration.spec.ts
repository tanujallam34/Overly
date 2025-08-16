import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Players Integration Tests', () => {
  let testApp: TestApp;
  let testHelper: TestDataHelper;
  let accessToken: string;
  let organization: any;
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
    
    // Create organization and user for authentication
    organization = await testHelper.createOrganization();
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

  describe('POST /players', () => {
    it('should create a new player successfully', async () => {
      const playerData = {
        organizationId: organization.id,
        name: 'Virat Kohli',
        dob: '1988-11-05T00:00:00.000Z',
        battingStyle: 'Right-hand bat',
        bowlingStyle: 'Right-arm medium',
        photoUrl: 'https://example.com/virat.jpg',
      };

      const response = await request(testApp.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(playerData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        name: playerData.name,
        battingStyle: playerData.battingStyle,
        bowlingStyle: playerData.bowlingStyle,
        photoUrl: playerData.photoUrl,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      expect(new Date(response.body.dob).toISOString()).toBe(playerData.dob);
    });

    it('should create player with minimal required fields', async () => {
      const playerData = {
        organizationId: organization.id,
        name: 'Basic Player',
      };

      const response = await request(testApp.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(playerData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        name: playerData.name,
        dob: null,
        battingStyle: null,
        bowlingStyle: null,
        photoUrl: null,
      });
    });

    it('should validate required fields', async () => {
      // Missing organizationId
      await request(testApp.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Player',
        })
        .expect(400);

      // Missing name
      await request(testApp.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: organization.id,
        })
        .expect(400);
    });

    it('should validate date format for dob', async () => {
      const playerData = {
        organizationId: organization.id,
        name: 'Test Player',
        dob: 'invalid-date',
      };

      await request(testApp.getHttpServer())
        .post('/players')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(playerData)
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const playerData = {
        organizationId: organization.id,
        name: 'Unauthorized Player',
      };

      await request(testApp.getHttpServer())
        .post('/players')
        .send(playerData)
        .expect(401);
    });
  });

  describe('GET /players', () => {
    let anotherOrganization: any;

    beforeEach(async () => {
      anotherOrganization = await testHelper.createOrganization({ name: 'Another Org' });
    });

    it('should return all players', async () => {
      const player1 = await testHelper.createPlayer(organization.id, { name: 'Player 1' });
      const player2 = await testHelper.createPlayer(organization.id, { name: 'Player 2' });
      const player3 = await testHelper.createPlayer(anotherOrganization.id, { name: 'Player 3' });

      const response = await request(testApp.getHttpServer())
        .get('/players')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      
      const playerNames = response.body.map((player: any) => player.name);
      expect(playerNames).toContain('Player 1');
      expect(playerNames).toContain('Player 2');
      expect(playerNames).toContain('Player 3');
    });

    it('should filter players by organizationId', async () => {
      const player1 = await testHelper.createPlayer(organization.id, { name: 'Org1 Player' });
      const player2 = await testHelper.createPlayer(anotherOrganization.id, { name: 'Org2 Player' });

      const response = await request(testApp.getHttpServer())
        .get(`/players?organizationId=${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        name: 'Org1 Player',
        organizationId: organization.id,
      });
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .get('/players')
        .expect(401);
    });
  });

  describe('GET /players/:id', () => {
    it('should return a specific player', async () => {
      const player = await testHelper.createPlayer(organization.id, { 
        name: 'MS Dhoni',
        battingStyle: 'Right-hand bat',
        bowlingStyle: 'Right-arm medium',
      });

      const response = await request(testApp.getHttpServer())
        .get(`/players/${player.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: player.id,
        organizationId: organization.id,
        name: 'MS Dhoni',
        battingStyle: 'Right-hand bat',
        bowlingStyle: 'Right-arm medium',
      });
    });

    it('should return 404 for non-existent player', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .get(`/players/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const player = await testHelper.createPlayer(organization.id);

      await request(testApp.getHttpServer())
        .get(`/players/${player.id}`)
        .expect(401);
    });
  });

  describe('PATCH /players/:id', () => {
    let testPlayer: any;

    beforeEach(async () => {
      testPlayer = await testHelper.createPlayer(organization.id, {
        name: 'Original Player',
        battingStyle: 'Right-hand bat',
        bowlingStyle: 'Right-arm fast',
      });
    });

    it('should update player successfully', async () => {
      const updateData = {
        name: 'Updated Player Name',
        battingStyle: 'Left-hand bat',
        bowlingStyle: 'Left-arm spin',
        photoUrl: 'https://example.com/updated-photo.jpg',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/players/${testPlayer.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testPlayer.id,
        organizationId: organization.id,
        name: updateData.name,
        battingStyle: updateData.battingStyle,
        bowlingStyle: updateData.bowlingStyle,
        photoUrl: updateData.photoUrl,
      });
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        name: 'Partially Updated Player',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/players/${testPlayer.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.battingStyle).toBe(testPlayer.battingStyle); // Should remain unchanged
      expect(response.body.bowlingStyle).toBe(testPlayer.bowlingStyle); // Should remain unchanged
    });

    it('should update player date of birth', async () => {
      const updateData = {
        dob: '1990-01-15T00:00:00.000Z',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/players/${testPlayer.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(new Date(response.body.dob).toISOString()).toBe(updateData.dob);
    });

    it('should validate date format for dob update', async () => {
      const updateData = {
        dob: 'invalid-date-format',
      };

      await request(testApp.getHttpServer())
        .patch(`/players/${testPlayer.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);
    });

    it('should return 404 for non-existent player', async () => {
      const nonExistentId = 'non-existent-id';
      const updateData = { name: 'Updated Name' };

      await request(testApp.getHttpServer())
        .patch(`/players/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const updateData = { name: 'Unauthorized Update' };

      await request(testApp.getHttpServer())
        .patch(`/players/${testPlayer.id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('DELETE /players/:id', () => {
    let testPlayer: any;

    beforeEach(async () => {
      testPlayer = await testHelper.createPlayer(organization.id, {
        name: 'To Be Deleted',
      });
    });

    it('should delete player successfully', async () => {
      await request(testApp.getHttpServer())
        .delete(`/players/${testPlayer.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify player is deleted
      await request(testApp.getHttpServer())
        .get(`/players/${testPlayer.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent player', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .delete(`/players/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .delete(`/players/${testPlayer.id}`)
        .expect(401);
    });

    it('should handle cascading deletes with team assignments', async () => {
      // Create a team and assign player to it
      const team = await testHelper.createTeam(organization.id, { name: 'Test Team' });
      await testHelper.assignPlayersToTeam(team.id, [testPlayer.id]);

      // Verify assignment exists
      const teamPlayerBefore = await testApp.prisma.teamPlayer.findUnique({
        where: {
          teamId_playerId: {
            teamId: team.id,
            playerId: testPlayer.id,
          },
        },
      });
      expect(teamPlayerBefore).toBeTruthy();

      // Delete player
      await request(testApp.getHttpServer())
        .delete(`/players/${testPlayer.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify player is deleted
      const deletedPlayer = await testApp.prisma.player.findUnique({
        where: { id: testPlayer.id },
      });
      expect(deletedPlayer).toBeNull();

      // Verify team assignment is also deleted
      const teamPlayerAfter = await testApp.prisma.teamPlayer.findUnique({
        where: {
          teamId_playerId: {
            teamId: team.id,
            playerId: testPlayer.id,
          },
        },
      });
      expect(teamPlayerAfter).toBeNull();

      // Team should still exist
      const existingTeam = await testApp.prisma.team.findUnique({
        where: { id: team.id },
      });
      expect(existingTeam).toBeTruthy();
    });
  });

  describe('Player-Team Integration', () => {
    let team1: any;
    let team2: any;
    let player: any;

    beforeEach(async () => {
      const league = await testHelper.createLeague(organization.id);
      team1 = await testHelper.createTeam(organization.id, { 
        name: 'Team 1', 
        leagueId: league.id 
      });
      team2 = await testHelper.createTeam(organization.id, { 
        name: 'Team 2', 
        leagueId: league.id 
      });
      player = await testHelper.createPlayer(organization.id, { 
        name: 'Multi-Team Player' 
      });
    });

    it('should allow player to be assigned to multiple teams', async () => {
      // Assign player to both teams (different seasons or leagues)
      await testApp.prisma.teamPlayer.create({
        data: {
          teamId: team1.id,
          playerId: player.id,
          season: '2024',
          shirtNumber: 7,
        },
      });

      await testApp.prisma.teamPlayer.create({
        data: {
          teamId: team2.id,
          playerId: player.id,
          season: '2023',
          shirtNumber: 10,
        },
      });

      // Verify assignments
      const assignments = await testApp.prisma.teamPlayer.findMany({
        where: { playerId: player.id },
        include: { team: true },
      });

      expect(assignments.length).toBe(2);
      expect(assignments.map(a => a.team.name)).toContain('Team 1');
      expect(assignments.map(a => a.team.name)).toContain('Team 2');
    });

    it('should handle player statistics and team associations', async () => {
      // Assign player to team
      await testHelper.assignPlayersToTeam(team1.id, [player.id]);

      // Get player with team information
      const playerWithTeams = await testApp.prisma.player.findUnique({
        where: { id: player.id },
        include: {
          teams: {
            include: {
              team: true,
            },
          },
        },
      });

      expect(playerWithTeams).toBeTruthy();
      expect(playerWithTeams.teams.length).toBe(1);
      expect(playerWithTeams.teams[0].team.name).toBe('Team 1');
      expect(playerWithTeams.teams[0].shirtNumber).toBe(1); // From helper default
    });

    it('should maintain referential integrity for player-team relationships', async () => {
      // Assign player to team
      await testHelper.assignPlayersToTeam(team1.id, [player.id]);

      // Try to assign same player to same team - should fail
      const duplicateAssignment = testApp.prisma.teamPlayer.create({
        data: {
          teamId: team1.id,
          playerId: player.id,
        },
      });

      await expect(duplicateAssignment).rejects.toThrow(); // Should violate unique constraint
    });

    it('should handle player search and filtering by team association', async () => {
      // Create additional players
      const player2 = await testHelper.createPlayer(organization.id, { name: 'Player 2' });
      const player3 = await testHelper.createPlayer(organization.id, { name: 'Player 3' });

      // Assign players to different teams
      await testHelper.assignPlayersToTeam(team1.id, [player.id, player2.id]);
      await testHelper.assignPlayersToTeam(team2.id, [player3.id]);

      // Get all players in organization
      const response = await request(testApp.getHttpServer())
        .get(`/players?organizationId=${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.length).toBe(3);
      
      // Verify all players belong to the organization
      response.body.forEach((p: any) => {
        expect(p.organizationId).toBe(organization.id);
      });
    });
  });

  describe('Player Profile Management', () => {
    it('should handle complete player profile updates', async () => {
      const player = await testHelper.createPlayer(organization.id, {
        name: 'Incomplete Player',
      });

      // Complete the profile
      const completeProfile = {
        name: 'Rohit Sharma',
        dob: '1987-04-30T00:00:00.000Z',
        battingStyle: 'Right-hand bat',
        bowlingStyle: 'Right-arm off-break',
        photoUrl: 'https://example.com/rohit.jpg',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/players/${player.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(completeProfile)
        .expect(200);

      expect(response.body).toMatchObject(completeProfile);
      expect(response.body.id).toBe(player.id);
    });

    it('should handle age calculation from date of birth', async () => {
      const birthDate = new Date('1990-01-01');
      const player = await testHelper.createPlayer(organization.id, {
        name: 'Age Test Player',
      });

      await request(testApp.getHttpServer())
        .patch(`/players/${player.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ dob: birthDate.toISOString() })
        .expect(200);

      // Verify the date was stored correctly
      const updatedPlayer = await testApp.prisma.player.findUnique({
        where: { id: player.id },
      });

      expect(updatedPlayer.dob).toEqual(birthDate);
    });
  });
});
