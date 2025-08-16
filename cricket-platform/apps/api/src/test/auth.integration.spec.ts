import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Authentication Integration Tests', () => {
  let testApp: TestApp;
  let testHelper: TestDataHelper;

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

  afterEach(async () => {
    await testApp.cleanup();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const organization = await testHelper.createOrganization();
      
      const userData = {
        email: 'testuser@example.com',
        name: 'Test User',
        password: 'password123',
        organizationId: organization.id,
      };

      const response = await request(testApp.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        email: userData.email,
        name: userData.name,
        organizationId: organization.id,
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject registration with duplicate email', async () => {
      const organization = await testHelper.createOrganization();
      const existingUser = await testHelper.createUser(organization.id, {
        email: 'existing@example.com'
      });

      const userData = {
        email: 'existing@example.com',
        name: 'Another User',
        password: 'password123',
        organizationId: organization.id,
      };

      await request(testApp.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(409);
    });

    it('should validate required fields', async () => {
      const organization = await testHelper.createOrganization();

      // Missing email
      await request(testApp.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          password: 'password123',
          organizationId: organization.id,
        })
        .expect(400);

      // Missing password
      await request(testApp.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          organizationId: organization.id,
        })
        .expect(400);

      // Invalid email format
      await request(testApp.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          name: 'Test User',
          password: 'password123',
          organizationId: organization.id,
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    let organization: any;
    let user: any;

    beforeEach(async () => {
      organization = await testHelper.createOrganization();
      user = await testHelper.createUser(organization.id, {
        email: 'testuser@example.com',
        password: 'password123'
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(testApp.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        id: user.id,
        email: 'testuser@example.com',
        organizationId: organization.id,
      });
    });

    it('should reject login with invalid email', async () => {
      await request(testApp.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);
    });

    it('should reject login with invalid password', async () => {
      await request(testApp.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let organization: any;
    let user: any;
    let refreshToken: string;

    beforeEach(async () => {
      organization = await testHelper.createOrganization();
      user = await testHelper.createUser(organization.id);

      const loginResponse = await request(testApp.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'password123',
        });

      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(testApp.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      await request(testApp.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let organization: any;
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      organization = await testHelper.createOrganization();
      user = await testHelper.createUser(organization.id);

      const loginResponse = await request(testApp.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'password123',
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(testApp.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: organization.id,
      });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      await request(testApp.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(testApp.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let organization: any;
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      organization = await testHelper.createOrganization();
      user = await testHelper.createUser(organization.id);

      const loginResponse = await request(testApp.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'password123',
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(testApp.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject logout without token', async () => {
      await request(testApp.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });
});
