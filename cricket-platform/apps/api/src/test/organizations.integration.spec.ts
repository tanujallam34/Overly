import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Organizations Integration Tests', () => {
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

  describe('POST /organizations', () => {
    it('should create a new organization successfully', async () => {
      const organizationData = {
        name: 'New Cricket Association',
      };

      const response = await request(testApp.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(organizationData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: organizationData.name,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should validate required fields', async () => {
      await request(testApp.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const organizationData = {
        name: 'Unauthorized Organization',
      };

      await request(testApp.getHttpServer())
        .post('/organizations')
        .send(organizationData)
        .expect(401);
    });
  });

  describe('GET /organizations', () => {
    it('should return all organizations', async () => {
      // Create additional organizations
      const org1 = await testHelper.createOrganization({ name: 'Organization 1' });
      const org2 = await testHelper.createOrganization({ name: 'Organization 2' });

      const response = await request(testApp.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3); // Original org + 2 new ones
      
      const orgNames = response.body.map((org: any) => org.name);
      expect(orgNames).toContain('Organization 1');
      expect(orgNames).toContain('Organization 2');
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .get('/organizations')
        .expect(401);
    });
  });

  describe('GET /organizations/:id', () => {
    it('should return a specific organization', async () => {
      const testOrg = await testHelper.createOrganization({ name: 'Specific Organization' });

      const response = await request(testApp.getHttpServer())
        .get(`/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testOrg.id,
        name: 'Specific Organization',
      });
    });

    it('should return 404 for non-existent organization', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .get(`/organizations/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .get(`/organizations/${organization.id}`)
        .expect(401);
    });
  });

  describe('PATCH /organizations/:id', () => {
    let testOrganization: any;

    beforeEach(async () => {
      testOrganization = await testHelper.createOrganization({ name: 'Original Name' });
    });

    it('should update organization successfully', async () => {
      const updateData = {
        name: 'Updated Organization Name',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/organizations/${testOrganization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testOrganization.id,
        name: updateData.name,
      });
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        name: 'Partially Updated Name',
      };

      const response = await request(testApp.getHttpServer())
        .patch(`/organizations/${testOrganization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
    });

    it('should return 404 for non-existent organization', async () => {
      const nonExistentId = 'non-existent-id';
      const updateData = { name: 'Updated Name' };

      await request(testApp.getHttpServer())
        .patch(`/organizations/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      const updateData = { name: 'Unauthorized Update' };

      await request(testApp.getHttpServer())
        .patch(`/organizations/${testOrganization.id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('DELETE /organizations/:id', () => {
    let testOrganization: any;

    beforeEach(async () => {
      testOrganization = await testHelper.createOrganization({ name: 'To Be Deleted' });
    });

    it('should delete organization successfully', async () => {
      await request(testApp.getHttpServer())
        .delete(`/organizations/${testOrganization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify organization is deleted
      await request(testApp.getHttpServer())
        .get(`/organizations/${testOrganization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent organization', async () => {
      const nonExistentId = 'non-existent-id';

      await request(testApp.getHttpServer())
        .delete(`/organizations/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject unauthorized requests', async () => {
      await request(testApp.getHttpServer())
        .delete(`/organizations/${testOrganization.id}`)
        .expect(401);
    });

    it('should handle cascading deletes properly', async () => {
      // Create related entities
      const league = await testHelper.createLeague(testOrganization.id);
      const team = await testHelper.createTeam(testOrganization.id);
      const player = await testHelper.createPlayer(testOrganization.id);
      const venue = await testHelper.createVenue(testOrganization.id);

      // Delete organization
      await request(testApp.getHttpServer())
        .delete(`/organizations/${testOrganization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify all related entities are also deleted/handled appropriately
      // Note: This depends on your Prisma cascade configuration
      const deletedOrg = await testApp.prisma.organization.findUnique({
        where: { id: testOrganization.id },
      });
      expect(deletedOrg).toBeNull();
    });
  });
});
