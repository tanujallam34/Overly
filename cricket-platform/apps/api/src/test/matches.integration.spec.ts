import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Matches Integration Tests', () => {
  let testApp: TestApp;
  let testHelper: TestDataHelper;
  let accessToken: string;
  let testSetup: any;

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
    
    // Create complete test setup
    testSetup = await testHelper.createFullTestSetup();

    // Login to get access token
    const loginResponse = await request(testApp.getHttpServer())
      .post('/auth/login')
      .send({
        email: testSetup.user.email,
        password: 'password123',
      });

    accessToken = loginResponse.body.accessToken;
  });

  describe('POST /matches', () => {
    it('should create a new match successfully', async () => {
      const matchData = {
        leagueId: testSetup.league.id,
        homeTeamId: testSetup.homeTeam.id,
        awayTeamId: testSetup.awayTeam.id,
        venueId: testSetup.venue.id,
        startTime: '2024-07-15T14:00:00.000Z',
        format: 'T20',
        oversLimit: 20,
        ballsPerOver: 6,
      };

      const response = await request(testApp.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(matchData)
        .expect(201);

      expect(response.body).toMatchObject({
        leagueId: testSetup.league.id,
        homeTeamId: testSetup.homeTeam.id,
        awayTeamId: testSetup.awayTeam.id,
        venueId: testSetup.venue.id,
        format: 'T20',
        oversLimit: 20,
        ballsPerOver: 6,
        status: 'scheduled',
        dlsUsed: false,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(new Date(response.body.startTime).toISOString()).toBe(matchData.startTime);
    });

    it('should create ODI match with different parameters', async () => {
      const matchData = {
        leagueId: testSetup.league.id,
        homeTeamId: testSetup.homeTeam.id,
        awayTeamId: testSetup.awayTeam.id,
        venueId: testSetup.venue.id,
        startTime: '2024-07-20T10:00:00.000Z',
        format: 'ODI',
        oversLimit: 50,
      };

      const response = await request(testApp.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(matchData)
        .expect(201);

      expect(response.body).toMatchObject({
        format: 'ODI',
        oversLimit: 50,
        ballsPerOver: 6, // Default value
      });
    });

    it('should create Test match without overs limit', async () => {
      const matchData = {
        leagueId: testSetup.league.id,
        homeTeamId: testSetup.homeTeam.id,
        awayTeamId: testSetup.awayTeam.id,
        venueId: testSetup.venue.id,
        startTime: '2024-07-25T10:00:00.000Z',
        format: 'Test',
        oversLimit: null,
      };

      const response = await request(testApp.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(matchData)
        .expect(201);

      expect(response.body).toMatchObject({
        format: 'Test',
        oversLimit: null,
      });
    });

    it('should validate required fields', async () => {
      // Missing homeTeamId
      await request(testApp.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          leagueId: testSetup.league.id,
          awayTeamId: testSetup.awayTeam.id,
          venueId: testSetup.venue.id,
          startTime: '2024-07-15T14:00:00.000Z',
          format: 'T20',
        })
        .expect(400);

      // Missing venueId
      await request(testApp.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          leagueId: testSetup.league.id,
          homeTeamId: testSetup.homeTeam.id,
          awayTeamId: testSetup.awayTeam.id,
          startTime: '2024-07-15T14:00:00.000Z',
          format: 'T20',
        })
        .expect(400);

      // Missing format
      await request(testApp.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          leagueId: testSetup.league.id,
          homeTeamId: testSetup.homeTeam.id,
          awayTeamId: testSetup.awayTeam.id,
          venueId: testSetup.venue.id,
          startTime: '2024-07-15T14:00:00.000Z',
        })
        .expect(400);
    });

    it('should reject same team as home and away', async () => {
      const matchData = {
        leagueId: testSetup.league.id,
        homeTeamId: testSetup.homeTeam.id,
        awayTeamId: testSetup.homeTeam.id, // Same as home team
        venueId: testSetup.venue.id,
        startTime: '2024-07-15T14:00:00.000Z',
        format: 'T20',
      };

      await request(testApp.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(matchData)
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const matchData = {
        leagueId: testSetup.league.id,
        homeTeamId: testSetup.homeTeam.id,
        awayTeamId: testSetup.awayTeam.id,
        venueId: testSetup.venue.id,
        startTime: '2024-07-15T14:00:00.000Z',
        format: 'T20',
      };

      await request(testApp.getHttpServer())
        .post('/matches')
        .send(matchData)
        .expect(401);
    });
  });

  describe('GET /matches', () => {
    let match1: any;
    let match2: any;
    let anotherLeague: any;

    beforeEach(async () => {
      anotherLeague = await testHelper.createLeague(testSetup.organization.id, { 
        name: 'Another League' 
      });

      match1 = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id,
        { format: 'T20', startTime: new Date('2024-06-01T14:00:00Z') }
      );

      match2 = await testHelper.createMatch(
        anotherLeague.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id,
        { format: 'ODI', startTime: new Date('2024-06-15T10:00:00Z') }
      );
    });

    it('should return all matches', async () => {
      const response = await request(testApp.getHttpServer())
        .get('/matches')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
      const matchIds = response.body.map((match: any) => match.id);
      expect(matchIds).toContain(match1.id);
      expect(matchIds).toContain(match2.id);
    });

    it('should filter matches by leagueId', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/matches?leagueId=${testSetup.league.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        id: match1.id,
        leagueId: testSetup.league.id,
        format: 'T20',
      });
    });

    it('should filter matches by status', async () => {
      // Update one match to live status
      await testApp.prisma.match.update({
        where: { id: match1.id },
        data: { status: 'live' },
      });

      const response = await request(testApp.getHttpServer())
        .get('/matches?status=live')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        id: match1.id,
        status: 'live',
      });
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .get('/matches')
        .expect(401);
    });
  });

  describe('GET /matches/:id', () => {
    let match: any;

    beforeEach(async () => {
      match = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id
      );
    });

    it('should return a specific match', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/matches/${match.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: match.id,
        leagueId: testSetup.league.id,
        homeTeamId: testSetup.homeTeam.id,
        awayTeamId: testSetup.awayTeam.id,
        venueId: testSetup.venue.id,
      });
    });

    it('should return 404 for non-existent match', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .get(`/matches/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('POST /matches/:id/toss', () => {
    let match: any;

    beforeEach(async () => {
      match = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id
      );
    });

    it('should conduct toss successfully', async () => {
      const tossData = {
        winnerTeamId: testSetup.homeTeam.id,
        decision: 'bat',
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(tossData)
        .expect(200);

      expect(response.body.toss).toMatchObject({
        winnerTeamId: testSetup.homeTeam.id,
        decision: 'bat',
      });
    });

    it('should conduct toss with bowl decision', async () => {
      const tossData = {
        winnerTeamId: testSetup.awayTeam.id,
        decision: 'bowl',
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(tossData)
        .expect(200);

      expect(response.body.toss).toMatchObject({
        winnerTeamId: testSetup.awayTeam.id,
        decision: 'bowl',
      });
    });

    it('should validate toss data', async () => {
      // Missing winnerTeamId
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ decision: 'bat' })
        .expect(400);

      // Missing decision
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ winnerTeamId: testSetup.homeTeam.id })
        .expect(400);

      // Invalid decision
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          winnerTeamId: testSetup.homeTeam.id,
          decision: 'invalid'
        })
        .expect(400);
    });

    it('should reject invalid winner team', async () => {
      const tossData = {
        winnerTeamId: 'invalid-team-id',
        decision: 'bat',
      };

      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(tossData)
        .expect(400);
    });

    it('should not allow duplicate toss', async () => {
      const tossData = {
        winnerTeamId: testSetup.homeTeam.id,
        decision: 'bat',
      };

      // First toss should succeed
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(tossData)
        .expect(200);

      // Second toss should fail
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(tossData)
        .expect(409);
    });
  });

  describe('POST /matches/:id/start', () => {
    let match: any;

    beforeEach(async () => {
      match = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id
      );

      // Conduct toss first
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          winnerTeamId: testSetup.homeTeam.id,
          decision: 'bat',
        });
    });

    it('should start match successfully', async () => {
      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: match.id,
        status: 'live',
      });
    });

    it('should not allow starting match without toss', async () => {
      // Create a new match without toss
      const newMatch = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id
      );

      await request(testApp.getHttpServer())
        .post(`/matches/${newMatch.id}/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should not allow starting already started match', async () => {
      // Start the match first time
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to start again
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('POST /matches/:id/assign', () => {
    let match: any;

    beforeEach(async () => {
      match = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id
      );
    });

    it('should assign scorer to match', async () => {
      const assignmentData = {
        userId: testSetup.user.id,
        role: 'scorer',
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(assignmentData)
        .expect(201);

      expect(response.body).toMatchObject({
        matchId: match.id,
        userId: testSetup.user.id,
        role: 'scorer',
      });
    });

    it('should assign umpire to match', async () => {
      const assignmentData = {
        userId: testSetup.user.id,
        role: 'umpire',
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(assignmentData)
        .expect(201);

      expect(response.body.role).toBe('umpire');
    });

    it('should not allow duplicate assignments', async () => {
      const assignmentData = {
        userId: testSetup.user.id,
        role: 'scorer',
      };

      // First assignment should succeed
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(assignmentData)
        .expect(201);

      // Duplicate assignment should fail
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(assignmentData)
        .expect(409);
    });
  });

  describe('POST /matches/:id/complete', () => {
    let match: any;

    beforeEach(async () => {
      match = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id
      );

      // Start the match
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          winnerTeamId: testSetup.homeTeam.id,
          decision: 'bat',
        });

      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/start`)
        .set('Authorization', `Bearer ${accessToken}`);
    });

    it('should complete match with win result', async () => {
      const completionData = {
        resultType: 'win',
        winnerTeamId: testSetup.homeTeam.id,
        winMargin: 25,
        winType: 'runs',
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: match.id,
        status: 'completed',
        resultType: 'win',
        winnerTeamId: testSetup.homeTeam.id,
        winMargin: 25,
        winType: 'runs',
      });
    });

    it('should complete match with tie result', async () => {
      const completionData = {
        resultType: 'tie',
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'completed',
        resultType: 'tie',
        winnerTeamId: null,
        winMargin: null,
        winType: null,
      });
    });

    it('should complete match with no-result', async () => {
      const completionData = {
        resultType: 'no-result',
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body.resultType).toBe('no-result');
    });

    it('should validate completion data for win', async () => {
      // Win result without winner team
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          resultType: 'win',
          winMargin: 25,
          winType: 'runs',
        })
        .expect(400);
    });
  });

  describe('DELETE /matches/:id', () => {
    let match: any;

    beforeEach(async () => {
      match = await testHelper.createMatch(
        testSetup.league.id,
        testSetup.homeTeam.id,
        testSetup.awayTeam.id,
        testSetup.venue.id
      );
    });

    it('should delete match successfully', async () => {
      await request(testApp.getHttpServer())
        .delete(`/matches/${match.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify match is deleted
      await request(testApp.getHttpServer())
        .get(`/matches/${match.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should not allow deletion of live match', async () => {
      // Start the match
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          winnerTeamId: testSetup.homeTeam.id,
          decision: 'bat',
        });

      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/start`)
        .set('Authorization', `Bearer ${accessToken}`);

      // Try to delete live match
      await request(testApp.getHttpServer())
        .delete(`/matches/${match.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should handle cascading deletes with assignments and toss', async () => {
      // Assign user and conduct toss
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: testSetup.user.id,
          role: 'scorer',
        });

      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/toss`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          winnerTeamId: testSetup.homeTeam.id,
          decision: 'bat',
        });

      // Delete match
      await request(testApp.getHttpServer())
        .delete(`/matches/${match.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify related entities are cleaned up
      const deletedMatch = await testApp.prisma.match.findUnique({
        where: { id: match.id },
      });
      expect(deletedMatch).toBeNull();

      const assignments = await testApp.prisma.assignment.findMany({
        where: { matchId: match.id },
      });
      expect(assignments.length).toBe(0);

      const toss = await testApp.prisma.toss.findUnique({
        where: { matchId: match.id },
      });
      expect(toss).toBeNull();
    });
  });
});
