import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe_Dev_Only_1';
const FIXTURE_PASSWORD = 'Passw0rd1234';

describe('Users & Roles (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let adminId: string;

  const server = () => app.getHttpServer();

  async function login(email: string, password: string): Promise<string> {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return res.body.accessToken as string;
  }

  function createUser(
    token: string,
    overrides: Partial<{
      email: string;
      fullName: string;
      password: string;
      roleKeys: string[];
      departmentId: string;
      branchId: string;
    }> = {},
  ): request.Test {
    return request(server())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: `e2e.${randomUUID()}@e2e.local`,
        fullName: 'E2E Fixture',
        password: FIXTURE_PASSWORD,
        roleKeys: ['support-agent'],
        ...overrides,
      });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });

    app.use(cookieParser());

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Customer Support CRM API')
      .setDescription('REST API for the Customer Support CRM.')
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'bearer',
      )
      .addCookieAuth('crm_refresh')
      .build();

    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
      swaggerOptions: { persistAuthorization: true },
    });

    app.enableShutdownHooks();

    await app.init();

    prisma = new PrismaClient();

    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('administrator CRUD', () => {
    let createdUserId: string;
    let createdEmail: string;

    it('GET /api/users with no token → 401', async () => {
      await request(server()).get('/api/users').expect(401);
    });

    it('GET /api/users as the administrator → 200 with items and meta, no passwordHash anywhere', async () => {
      const res = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toEqual(expect.any(Array));
      expect(res.body.meta).toEqual(
        expect.objectContaining({ page: 1, pageSize: 20, total: expect.any(Number) }),
      );

      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain('passwordHash');
      expect(serialised).not.toContain('scrypt$');
    });

    it('POST /api/users creates an account → 201, roles, mustChangePassword, isActive', async () => {
      createdEmail = `e2e.nour.${randomUUID()}@e2e.local`;

      const res = await createUser(adminToken, {
        email: createdEmail,
        fullName: 'E2E Nour Hassan',
      }).expect(201);

      createdUserId = res.body.id;

      expect(res.body.roles).toEqual(['support-agent']);
      expect(res.body.mustChangePassword).toBe(true);
      expect(res.body.isActive).toBe(true);
    });

    it('the created user can log in — seed and service hash formats agree', async () => {
      await request(server())
        .post('/api/auth/login')
        .send({ email: createdEmail, password: FIXTURE_PASSWORD })
        .expect(200);
    });

    it('POST /api/users with the same email again → 409', async () => {
      await createUser(adminToken, { email: createdEmail }).expect(409);
    });

    it('POST /api/users with the same email in upper case → 409', async () => {
      await createUser(adminToken, { email: createdEmail.toUpperCase() }).expect(409);
    });

    it('POST /api/users with an unknown role key → 400', async () => {
      await createUser(adminToken, { roleKeys: ['nope'] }).expect(400);
    });

    it('POST /api/users with an unknown departmentId → 400', async () => {
      await createUser(adminToken, { departmentId: randomUUID() }).expect(400);
    });

    it('POST /api/users with an 8-character password → 400', async () => {
      await createUser(adminToken, { password: 'Pass012a' }).expect(400);
    });

    it("POST /api/users with 'passwordpassword' (no digit) → 400", async () => {
      await createUser(adminToken, { password: 'passwordpassword' }).expect(400);
    });

    it('GET /api/users?search=<partial upper-case name> finds the created user', async () => {
      const res = await request(server())
        .get('/api/users')
        .query({ search: 'NOUR HASSAN' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === createdUserId)).toBe(true);
    });

    it('GET /api/users?pageSize=1000000 → 400', async () => {
      await request(server())
        .get('/api/users')
        .query({ pageSize: 1000000 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('GET /api/users?page=9999 → 200 with items: []', async () => {
      const res = await request(server())
        .get('/api/users')
        .query({ page: 9999 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toEqual([]);
    });

    it('GET /api/users?isActive=false does not include the newly created active user', async () => {
      const res = await request(server())
        .get('/api/users')
        .query({ isActive: 'false', pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === createdUserId)).toBe(
        false,
      );
    });

    it('GET /api/users/not-a-uuid → 400', async () => {
      await request(server())
        .get('/api/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('PATCH /api/users/:id changing fullName → 200 with the new name', async () => {
      const res = await request(server())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fullName: 'E2E Nour Hassan Renamed' })
        .expect(200);

      expect(res.body.fullName).toBe('E2E Nour Hassan Renamed');
    });

    it('PATCH /api/users/:id with { departmentId: null } → department becomes null', async () => {
      const res = await request(server())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: null })
        .expect(200);

      expect(res.body.department).toBeNull();
    });
  });

  describe('status, roles, and password administration', () => {
    it('PATCH /api/users/:id/status { isActive: false } → 200, then login → 401', async () => {
      const created = await createUser(adminToken).expect(201);

      const res = await request(server())
        .patch(`/api/users/${created.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(res.body.isActive).toBe(false);

      await request(server())
        .post('/api/auth/login')
        .send({ email: created.body.email, password: FIXTURE_PASSWORD })
        .expect(401);
    });

    it("PATCH /api/users/:id/status targeting the administrator's own id → 400", async () => {
      await request(server())
        .patch(`/api/users/${adminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(400);
    });

    it("PUT /api/users/:id/roles with ['support-agent','reporting-user'] → 200 with both, sorted", async () => {
      const created = await createUser(adminToken).expect(201);

      const res = await request(server())
        .put(`/api/users/${created.body.id}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleKeys: ['support-agent', 'reporting-user'] })
        .expect(200);

      expect(res.body.roles).toEqual(['reporting-user', 'support-agent']);
    });

    it('POST /api/users/:id/password → 204, new password works, old does not', async () => {
      const created = await createUser(adminToken).expect(201);

      await request(server())
        .post(`/api/users/${created.body.id}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'BrandNewPassw0rd' })
        .expect(204);

      await request(server())
        .post('/api/auth/login')
        .send({ email: created.body.email, password: 'BrandNewPassw0rd' })
        .expect(200);

      await request(server())
        .post('/api/auth/login')
        .send({ email: created.body.email, password: FIXTURE_PASSWORD })
        .expect(401);
    });
  });

  describe('permission enforcement from a restricted account', () => {
    let agentToken: string;
    let agentId: string;

    beforeAll(async () => {
      const created = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentId = created.body.id;
      agentToken = await login(created.body.email, FIXTURE_PASSWORD);
    });

    it('GET /api/users → 403, naming users:read', async () => {
      const res = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      expect(res.body.message).toContain('users:read');
    });

    it('POST /api/users → 403', async () => {
      await createUser(agentToken).expect(403);
    });

    it('PATCH /api/users/:id/status → 403', async () => {
      await request(server())
        .patch(`/api/users/${adminId}/status`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ isActive: false })
        .expect(403);
    });

    it('PUT /api/users/:id/roles → 403', async () => {
      await request(server())
        .put(`/api/users/${agentId}/roles`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ roleKeys: ['support-agent'] })
        .expect(403);
    });

    it('GET /api/users/<their own id> → 200 (self-read floor)', async () => {
      await request(server())
        .get(`/api/users/${agentId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);
    });

    it("GET /api/users/<the administrator's id> → 403", async () => {
      await request(server())
        .get(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });

    it('GET /api/auth/me → 200 (no permission required)', async () => {
      await request(server())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);
    });

    it('GET /api/departments → 200', async () => {
      await request(server())
        .get('/api/departments')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);
    });

    it('POST /api/departments → 403', async () => {
      await request(server())
        .post('/api/departments')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ key: 'e2e-should-fail', name: 'Should fail' })
        .expect(403);
    });
  });

  describe('privilege escalation', () => {
    let managerToken: string;
    let managerId: string;
    let targetAgentId: string;

    beforeAll(async () => {
      const manager = await createUser(adminToken, { roleKeys: ['crm-manager'] }).expect(201);
      managerId = manager.body.id;
      managerToken = await login(manager.body.email, FIXTURE_PASSWORD);

      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      targetAgentId = agent.body.id;
    });

    it("PUT /api/users/<own id>/roles with ['system-administrator'] → 403", async () => {
      await request(server())
        .put(`/api/users/${managerId}/roles`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ roleKeys: ['system-administrator'] })
        .expect(403);
    });

    it("POST /api/users with roleKeys: ['system-administrator'] → 403", async () => {
      await createUser(managerToken, { roleKeys: ['system-administrator'] }).expect(403);
    });

    it("PUT /api/users/<a support agent's id>/roles with ['reporting-user'] → 200", async () => {
      await request(server())
        .put(`/api/users/${targetAgentId}/roles`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ roleKeys: ['reporting-user'] })
        .expect(200);
    });
  });

  describe('last-administrator protection', () => {
    let secondAdminToken: string;
    let secondAdminId: string;

    afterAll(async () => {
      await prisma.userRole.deleteMany({ where: { userId: adminId } });
      const adminRole = await prisma.role.findUniqueOrThrow({
        where: { key: 'system-administrator' },
      });
      await prisma.userRole.create({ data: { userId: adminId, roleId: adminRole.id } });
    });

    it('step 1 — self-deactivation is blocked first → 400', async () => {
      await request(server())
        .patch(`/api/users/${adminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(400);
    });

    it('step 2 — a second administrator can demote the original (one active admin remains) → 200', async () => {
      const created = await createUser(adminToken, {
        roleKeys: ['system-administrator'],
      }).expect(201);
      secondAdminId = created.body.id;
      secondAdminToken = await login(created.body.email, FIXTURE_PASSWORD);

      const res = await request(server())
        .put(`/api/users/${adminId}/roles`)
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .send({ roleKeys: ['crm-manager'] })
        .expect(200);

      expect(res.body.roles).toEqual(['crm-manager']);
    });

    it('step 3 — the last remaining administrator cannot demote themselves → 400', async () => {
      const res = await request(server())
        .put(`/api/users/${secondAdminId}/roles`)
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .send({ roleKeys: ['crm-manager'] })
        .expect(400);

      expect(res.body.message).toContain('cannot be demoted');
    });
  });
});
