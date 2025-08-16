import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Leagues Integration Tests', () => {
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

  describe('POST /leagues', () => {
    it('should create a new league successfully', async () => {
      const leagueData = {
        organizationId: organization.id,
        name: 'Premier League',
        season: '2024',
        rulesetId: 'test-ruleset-id',
      };

      const response = await request(testApp.getHttpServer())
        .post('/leagues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(leagueData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        name: leagueData.name,
        season: leagueData.season,
        rulesetId: leagueData.rulesetId,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should create league without optional rulesetId', async () => {
      const leagueData = {
        organizationId: organization.id,
        name: 'Local League',
        season: '2024',
      };

      const response = await request(testApp.getHttpServer())
        .post('/leagues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(leagueData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        name: leagueData.name,
        season: leagueData.season,
        rulesetId: null,
      });
    });

    it('should validate required fields', async () => {
      // Missing organizationId
      await request(testApp.getHttpServer())
        .post('/leagues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test League',
          season: '2024',
        })
        .expect(400);

      // Missing name
      await request(testApp.getHttpServer())
        .post('/leagues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: organization.id,
          season: '2024',
        })
        .expect(400);

      // Missing season
      await request(testApp.getHttpServer())
        .post('/leagues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: organization.id,
          name: 'Test League',
        })
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const leagueData = {
        organizationId: organization.id,
        name: 'Unauthorized League',
        season: '2024',
      };

      await request(testApp.getHttpServer())
        .post('/leagues')
        .send(leagueData)
        .expect(401);
    });
  });

  describe('GET /leagues', () => {
    let anotherOrganization: any;

    beforeEach(async () => {
      anotherOrganization = await testHelper.createOrganization({ name: 'Another Org' });
    });

    it('should return all leagues', async () => {
      const league1 = await testHelper.createLeague(organization.id, { name: 'League 1' });
      const league2 = await testHelper.createLeague(organization.id, { name: 'League 2' });
      const league3 = await testHelper.createLeague(anotherOrganization.id, { name: 'League 3' });

      const response = await request(testApp.getHttpServer())
        .get('/leagues')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      
      const leagueNames = response.body.map((league: any) => league.name);
      expect(leagueNames).toContain('League 1');
      expect(leagueNames).toContain('League 2');
      expect(leagueNames).toContain('League 3');
    });

    it('should filter leagues by organizationId', async () => {
      const league1 = await testHelper.createLeague(organization.id, { name: 'Org1 League' });
      const league2 = await testHelper.createLeague(anotherOrganization.id, { name: 'Org2 League' });

      const response = await request(testApp.getHttpServer())
        .get(`/leagues?organizationId=${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        name: 'Org1 League',
        organizationId: organization.id,
      });
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .get('/leagues')
        .expect(401);
    });
  });

  describe('GET /leagues/:id', () => {
    it('should return a specific league', async () => {
      const league = await testHelper.createLeague(organization.id, { 
        name: 'Specific League',
        season: '2024-25'
      });

      const response = await request(testApp.getHttpServer())
        .get(`/leagues/${league.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: league.id,
        organizationId: organization.id,
        name: 'Specific League',
        season: '2024-25',
      });
    });

    it('should return 404 for non-existent league', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .get(`/leagues/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const league = await testHelper.createLeague(organization.id);

      await request(testApp.getHttpServer())
        .get(`/leagues/${league.id}`)
        .expect(401);
    });
  });

  describe('PATCH /leagues/:id', () => {
    let testLeague: any;

    beforeEach(async () => {
      testLeague = await testHelper.createLeague(organization.id, {
        name: 'Original League',
        season: '2024',
      });
    });

    it('should update league successfully', async () => {
      const updateData = {
        name: 'Updated League Name',
        season: '2024-25',
        rulesetId: 'new-ruleset-id',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/leagues/${testLeague.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testLeague.id,
        organizationId: organization.id,
        name: updateData.name,
        season: updateData.season,
        rulesetId: updateData.rulesetId,
      });
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        name: 'Partially Updated League',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/leagues/${testLeague.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.season).toBe(testLeague.season); // Should remain unchanged
    });

    it('should return 404 for non-existent league', async () => {
      const nonExistentId = 'non-existent-id';
      const updateData = { name: 'Updated Name' };

      await request(testApp.getHttpServer())
        .patch(`/leagues/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const updateData = { name: 'Unauthorized Update' };

      await request(testApp.getHttpServer())
        .patch(`/leagues/${testLeague.id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('DELETE /leagues/:id', () => {
    let testLeague: any;

    beforeEach(async () => {
      testLeague = await testHelper.createLeague(organization.id, {
        name: 'To Be Deleted',
      });
    });

    it('should delete league successfully', async () => {
      await request(testApp.getHttpServer())
        .delete(`/leagues/${testLeague.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify league is deleted
      await request(testApp.getHttpServer())
        .get(`/leagues/${testLeague.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent league', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .delete(`/leagues/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .delete(`/leagues/${testLeague.id}`)
        .expect(401);
    });

    it('should handle cascading deletes with teams and matches', async () => {
      // Create teams associated with the league
      const team1 = await testHelper.createTeam(organization.id, { 
        name: 'Team 1', 
        leagueId: testLeague.id 
      });
      const team2 = await testHelper.createTeam(organization.id, { 
        name: 'Team 2', 
        leagueId: testLeague.id 
      });

      // Create a venue for the match
      const venue = await testHelper.createVenue(organization.id);

      // Create a match in the league
      const match = await testHelper.createMatch(
        testLeague.id,
        team1.id,
        team2.id,
        venue.id
      );

      // Delete league
      await request(testApp.getHttpServer())
        .delete(`/leagues/${testLeague.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify league is deleted
      const deletedLeague = await testApp.prisma.league.findUnique({
        where: { id: testLeague.id },
      });
      expect(deletedLeague).toBeNull();

      // Verify related entities are handled appropriately
      // Note: This depends on your Prisma cascade configuration
    });
  });
});
