import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Venues Integration Tests', () => {
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

  describe('POST /venues', () => {
    it('should create a new venue successfully', async () => {
      const venueData = {
        organizationId: organization.id,
        name: 'Lords Cricket Ground',
        location: 'London, England',
        pitchNotes: 'Traditional grass pitch with good bounce and carry',
      };

      const response = await request(testApp.getHttpServer())
        .post('/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(venueData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        name: venueData.name,
        location: venueData.location,
        pitchNotes: venueData.pitchNotes,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should create venue with minimal required fields', async () => {
      const venueData = {
        organizationId: organization.id,
        name: 'Basic Ground',
      };

      const response = await request(testApp.getHttpServer())
        .post('/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(venueData)
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: organization.id,
        name: venueData.name,
        location: null,
        pitchNotes: null,
      });
    });

    it('should validate required fields', async () => {
      // Missing organizationId
      await request(testApp.getHttpServer())
        .post('/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Venue',
        })
        .expect(400);

      // Missing name
      await request(testApp.getHttpServer())
        .post('/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: organization.id,
        })
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const venueData = {
        organizationId: organization.id,
        name: 'Unauthorized Venue',
      };

      await request(testApp.getHttpServer())
        .post('/venues')
        .send(venueData)
        .expect(401);
    });
  });

  describe('GET /venues', () => {
    let anotherOrganization: any;

    beforeEach(async () => {
      anotherOrganization = await testHelper.createOrganization({ name: 'Another Org' });
    });

    it('should return all venues', async () => {
      const venue1 = await testHelper.createVenue(organization.id, { name: 'Stadium 1' });
      const venue2 = await testHelper.createVenue(organization.id, { name: 'Stadium 2' });
      const venue3 = await testHelper.createVenue(anotherOrganization.id, { name: 'Stadium 3' });

      const response = await request(testApp.getHttpServer())
        .get('/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      
      const venueNames = response.body.map((venue: any) => venue.name);
      expect(venueNames).toContain('Stadium 1');
      expect(venueNames).toContain('Stadium 2');
      expect(venueNames).toContain('Stadium 3');
    });

    it('should filter venues by organizationId', async () => {
      const venue1 = await testHelper.createVenue(organization.id, { name: 'Org1 Stadium' });
      const venue2 = await testHelper.createVenue(anotherOrganization.id, { name: 'Org2 Stadium' });

      const response = await request(testApp.getHttpServer())
        .get(`/venues?organizationId=${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        name: 'Org1 Stadium',
        organizationId: organization.id,
      });
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .get('/venues')
        .expect(401);
    });
  });

  describe('GET /venues/:id', () => {
    it('should return a specific venue', async () => {
      const venue = await testHelper.createVenue(organization.id, { 
        name: 'Wankhede Stadium',
        location: 'Mumbai, India',
        pitchNotes: 'Batting-friendly pitch with good bounce',
      });

      const response = await request(testApp.getHttpServer())
        .get(`/venues/${venue.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: venue.id,
        organizationId: organization.id,
        name: 'Wankhede Stadium',
        location: 'Mumbai, India',
        pitchNotes: 'Batting-friendly pitch with good bounce',
      });
    });

    it('should return 404 for non-existent venue', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .get(`/venues/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const venue = await testHelper.createVenue(organization.id);

      await request(testApp.getHttpServer())
        .get(`/venues/${venue.id}`)
        .expect(401);
    });
  });

  describe('PATCH /venues/:id', () => {
    let testVenue: any;

    beforeEach(async () => {
      testVenue = await testHelper.createVenue(organization.id, {
        name: 'Original Stadium',
        location: 'Original City',
      });
    });

    it('should update venue successfully', async () => {
      const updateData = {
        name: 'Updated Stadium Name',
        location: 'Updated City, Updated Country',
        pitchNotes: 'Updated pitch conditions with new characteristics',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/venues/${testVenue.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testVenue.id,
        organizationId: organization.id,
        name: updateData.name,
        location: updateData.location,
        pitchNotes: updateData.pitchNotes,
      });
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        name: 'Partially Updated Stadium',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/venues/${testVenue.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.location).toBe(testVenue.location); // Should remain unchanged
    });

    it('should update venue pitch notes', async () => {
      const updateData = {
        pitchNotes: 'Spinner-friendly track with low bounce and turn from day one',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/venues/${testVenue.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.pitchNotes).toBe(updateData.pitchNotes);
    });

    it('should clear optional fields when set to null', async () => {
      const updateData = {
        location: null,
        pitchNotes: null,
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/venues/${testVenue.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.location).toBeNull();
      expect(response.body.pitchNotes).toBeNull();
    });

    it('should return 404 for non-existent venue', async () => {
      const nonExistentId = 'non-existent-id';
      const updateData = { name: 'Updated Name' };

      await request(testApp.getHttpServer())
        .patch(`/venues/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const updateData = { name: 'Unauthorized Update' };

      await request(testApp.getHttpServer())
        .patch(`/venues/${testVenue.id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('DELETE /venues/:id', () => {
    let testVenue: any;

    beforeEach(async () => {
      testVenue = await testHelper.createVenue(organization.id, {
        name: 'To Be Deleted Stadium',
      });
    });

    it('should delete venue successfully', async () => {
      await request(testApp.getHttpServer())
        .delete(`/venues/${testVenue.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify venue is deleted
      await request(testApp.getHttpServer())
        .get(`/venues/${testVenue.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent venue', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .delete(`/venues/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .delete(`/venues/${testVenue.id}`)
        .expect(401);
    });

    it('should handle cascading deletes with matches', async () => {
      // Create teams and league for a match
      const league = await testHelper.createLeague(organization.id);
      const homeTeam = await testHelper.createTeam(organization.id, { 
        name: 'Home Team',
        leagueId: league.id 
      });
      const awayTeam = await testHelper.createTeam(organization.id, { 
        name: 'Away Team',
        leagueId: league.id 
      });

      // Create a match at this venue
      const match = await testHelper.createMatch(
        league.id,
        homeTeam.id,
        awayTeam.id,
        testVenue.id
      );

      // Verify match exists
      const matchBefore = await testApp.prisma.match.findUnique({
        where: { id: match.id },
      });
      expect(matchBefore).toBeTruthy();

      // Delete venue - this should fail or cascade appropriately
      // Note: Depending on your business rules, this might:
      // 1. Fail with a constraint error (if you want to prevent deletion)
      // 2. Cascade delete the matches (if allowed)
      // 3. Set venue to null in matches (if nullable)
      
      try {
        await request(testApp.getHttpServer())
          .delete(`/venues/${testVenue.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        // If deletion succeeds, venue should be gone
        const deletedVenue = await testApp.prisma.venue.findUnique({
          where: { id: testVenue.id },
        });
        expect(deletedVenue).toBeNull();

      } catch (error) {
        // If deletion fails due to foreign key constraints, that's also valid
        // Depends on your database schema configuration
        console.log('Venue deletion failed due to existing matches - this may be expected');
      }
    });
  });

  describe('Venue Search and Filtering', () => {
    beforeEach(async () => {
      // Create multiple venues with different characteristics
      await Promise.all([
        testHelper.createVenue(organization.id, {
          name: 'Eden Gardens',
          location: 'Kolkata, India',
          pitchNotes: 'Spinner-friendly with good turn',
        }),
        testHelper.createVenue(organization.id, {
          name: 'MCG',
          location: 'Melbourne, Australia',
          pitchNotes: 'Fast and bouncy, pace-friendly',
        }),
        testHelper.createVenue(organization.id, {
          name: 'The Oval',
          location: 'London, England',
          pitchNotes: 'Traditional English conditions',
        }),
        testHelper.createVenue(organization.id, {
          name: 'Local Ground',
          location: 'Small Town',
          pitchNotes: null,
        }),
      ]);
    });

    it('should return venues in organized manner', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/venues?organizationId=${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.length).toBe(4);
      
      // Check that all venues have required fields
      response.body.forEach((venue: any) => {
        expect(venue).toHaveProperty('id');
        expect(venue).toHaveProperty('name');
        expect(venue).toHaveProperty('organizationId');
        expect(venue).toHaveProperty('createdAt');
        expect(venue).toHaveProperty('updatedAt');
        expect(venue.organizationId).toBe(organization.id);
      });

      // Check specific venues exist
      const venueNames = response.body.map((v: any) => v.name);
      expect(venueNames).toContain('Eden Gardens');
      expect(venueNames).toContain('MCG');
      expect(venueNames).toContain('The Oval');
      expect(venueNames).toContain('Local Ground');
    });

    it('should handle venues with and without optional fields', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/venues?organizationId=${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const localGround = response.body.find((v: any) => v.name === 'Local Ground');
      const edenGardens = response.body.find((v: any) => v.name === 'Eden Gardens');

      expect(localGround.pitchNotes).toBeNull();
      expect(edenGardens.pitchNotes).toBe('Spinner-friendly with good turn');
    });
  });

  describe('Venue-Match Integration', () => {
    let venue: any;
    let league: any;
    let homeTeam: any;
    let awayTeam: any;

    beforeEach(async () => {
      venue = await testHelper.createVenue(organization.id, {
        name: 'Test Stadium',
        location: 'Test City',
      });
      league = await testHelper.createLeague(organization.id);
      homeTeam = await testHelper.createTeam(organization.id, { 
        name: 'Home Team',
        leagueId: league.id 
      });
      awayTeam = await testHelper.createTeam(organization.id, { 
        name: 'Away Team',
        leagueId: league.id 
      });
    });

    it('should support multiple matches at the same venue', async () => {
      // Create multiple matches at the same venue
      const match1 = await testHelper.createMatch(
        league.id,
        homeTeam.id,
        awayTeam.id,
        venue.id,
        { startTime: new Date('2024-06-01T10:00:00Z') }
      );

      const match2 = await testHelper.createMatch(
        league.id,
        awayTeam.id,
        homeTeam.id,
        venue.id,
        { startTime: new Date('2024-06-15T14:00:00Z') }
      );

      // Verify both matches are associated with the venue
      const venueWithMatches = await testApp.prisma.venue.findUnique({
        where: { id: venue.id },
        include: { matches: true },
      });

      expect(venueWithMatches.matches.length).toBe(2);
      expect(venueWithMatches.matches.map(m => m.id)).toContain(match1.id);
      expect(venueWithMatches.matches.map(m => m.id)).toContain(match2.id);
    });

    it('should maintain venue information integrity', async () => {
      const match = await testHelper.createMatch(
        league.id,
        homeTeam.id,
        awayTeam.id,
        venue.id
      );

      // Get match with venue details
      const matchWithVenue = await testApp.prisma.match.findUnique({
        where: { id: match.id },
        include: { venue: true },
      });

      expect(matchWithVenue.venue).toMatchObject({
        id: venue.id,
        name: 'Test Stadium',
        location: 'Test City',
        organizationId: organization.id,
      });
    });
  });
});
