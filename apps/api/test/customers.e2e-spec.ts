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

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;

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
    overrides: Partial<{ email: string; fullName: string; password: string; roleKeys: string[] }> = {},
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

  function createCustomer(
    token: string,
    overrides: Partial<{
      name: string;
      email: string;
      phone: string;
      status: string;
      type: string;
      assignedAgentId: string;
    }> = {},
  ): request.Test {
    return request(server())
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `E2E Customer ${randomUUID()}`, ...overrides });
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
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('administrator CRUD', () => {
    let createdId: string;

    it('GET /api/customers with no token → 401', async () => {
      await request(server()).get('/api/customers').expect(401);
    });

    it('GET /api/customers as the administrator → 200, items array, meta with page/pageSize', async () => {
      const res = await request(server())
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toEqual(expect.any(Array));
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, pageSize: 20 }));
    });

    it('POST /api/customers with { name } only → 201, PROSPECT, INDIVIDUAL, zero counts', async () => {
      const res = await createCustomer(adminToken, { name: `E2E Minimal ${randomUUID()}` }).expect(
        201,
      );

      createdId = res.body.id;

      expect(res.body.status).toBe('PROSPECT');
      expect(res.body.type).toBe('INDIVIDUAL');
      expect(res.body.counts).toEqual({ notes: 0, attachments: 0, interactions: 0 });
    });

    it('POST with full contact details → 201, echoes them back', async () => {
      const name = `E2E Full Contact ${randomUUID()}`;
      const res = await request(server())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'COMPANY',
          name,
          companyName: 'Orten Trading',
          email: `e2e.full.${randomUUID()}@e2e.local`,
          phone: '+20 100 000 0000',
          city: 'Cairo',
          country: 'Egypt',
        })
        .expect(201);

      expect(res.body.name).toBe(name);
      expect(res.body.companyName).toBe('Orten Trading');
      expect(res.body.city).toBe('Cairo');
      expect(res.body.country).toBe('Egypt');
    });

    it('POST with a duplicate email (different case) → 409', async () => {
      const email = `E2E.Dup.${randomUUID()}@e2e.local`;
      await createCustomer(adminToken, { name: 'E2E Dup One', email }).expect(201);

      await createCustomer(adminToken, {
        name: 'E2E Dup Two',
        email: email.toLowerCase(),
      }).expect(409);
    });

    it('two POSTs with no email → both 201', async () => {
      await createCustomer(adminToken, { name: 'E2E No Email One' }).expect(201);
      await createCustomer(adminToken, { name: 'E2E No Email Two' }).expect(201);
    });

    it('POST with an unknown assignedAgentId → 400', async () => {
      await createCustomer(adminToken, { assignedAgentId: randomUUID() }).expect(400);
    });

    it("POST with phone: 'not a phone' → 400", async () => {
      await createCustomer(adminToken, { phone: 'not a phone' }).expect(400);
    });

    it("POST with name: 'A' → 400 (minimum length)", async () => {
      await createCustomer(adminToken, { name: 'A' }).expect(400);
    });

    it('GET /api/customers/:id → 200 with assignedAgent, createdBy, counts', async () => {
      const res = await request(server())
        .get(`/api/customers/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('assignedAgent');
      expect(res.body).toHaveProperty('createdBy');
      expect(res.body).toHaveProperty('counts');
    });

    it('GET /api/customers/not-a-uuid → 400', async () => {
      await request(server())
        .get('/api/customers/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('GET /api/customers/<random uuid> → 404', async () => {
      await request(server())
        .get(`/api/customers/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('PATCH /api/customers/:id changing name and clearing city with null → 200, city: null', async () => {
      const created = await createCustomer(adminToken, {
        name: 'E2E Patch Target',
      }).expect(201);

      const res = await request(server())
        .patch(`/api/customers/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Patch Target Renamed', city: null })
        .expect(200);

      expect(res.body.name).toBe('E2E Patch Target Renamed');
      expect(res.body.city).toBeNull();
    });
  });

  describe('search and filter', () => {
    let searchFixtureId: string;
    const searchName = `E2E Zebra Corp ${randomUUID()}`;
    const searchPhone = `+20${Math.floor(1000000 + Math.random() * 8999999)}`;

    beforeAll(async () => {
      const created = await createCustomer(adminToken, {
        name: searchName,
        phone: searchPhone,
      }).expect(201);
      searchFixtureId = created.body.id;
    });

    it('finds the fixture by a partial name fragment in the wrong case', async () => {
      const fragment = searchName.slice(5, 15).toLowerCase();

      const res = await request(server())
        .get('/api/customers')
        .query({ search: fragment, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === searchFixtureId)).toBe(
        true,
      );
    });

    it('finds the fixture by a partial phone fragment', async () => {
      const fragment = searchPhone.slice(-6);

      const res = await request(server())
        .get('/api/customers')
        .query({ search: fragment, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === searchFixtureId)).toBe(
        true,
      );
    });

    it('status=ACTIVE excludes a PROSPECT fixture', async () => {
      const res = await request(server())
        .get('/api/customers')
        .query({ status: 'ACTIVE', pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === searchFixtureId)).toBe(
        false,
      );
    });

    it('an unknown query parameter → 400 (forbidNonWhitelisted)', async () => {
      await request(server())
        .get('/api/customers')
        .query({ sortBy: 'name' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('pageSize=1000000 → 400', async () => {
      await request(server())
        .get('/api/customers')
        .query({ pageSize: 1000000 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('page=9999 → 200 with items: []', async () => {
      const res = await request(server())
        .get('/api/customers')
        .query({ page: 9999 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toEqual([]);
    });
  });

  describe('status lifecycle and archive gate', () => {
    let customerId: string;

    beforeAll(async () => {
      const created = await createCustomer(adminToken, { name: 'E2E Lifecycle Target' }).expect(
        201,
      );
      customerId = created.body.id;
    });

    it('PATCH .../status to ACTIVE as the administrator → 200', async () => {
      const res = await request(server())
        .patch(`/api/customers/${customerId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(res.body.status).toBe('ACTIVE');
    });

    it('PATCH .../status to ARCHIVED as the administrator → 200, then PATCH the customer → 400', async () => {
      await request(server())
        .patch(`/api/customers/${customerId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' })
        .expect(200);

      await request(server())
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Should Not Apply' })
        .expect(400);
    });
  });

  describe('permission enforcement from a restricted account', () => {
    let supervisorToken: string;
    let archivedTargetId: string;

    beforeAll(async () => {
      const supervisor = await createUser(adminToken, { roleKeys: ['support-supervisor'] }).expect(
        201,
      );
      supervisorToken = await login(supervisor.body.email, FIXTURE_PASSWORD);

      const created = await createCustomer(adminToken, {
        name: 'E2E Restricted Archive Target',
      }).expect(201);
      archivedTargetId = created.body.id;

      await request(server())
        .patch(`/api/customers/${archivedTargetId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' })
        .expect(200);
    });

    it('GET /api/customers → 200', async () => {
      await request(server())
        .get('/api/customers')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);
    });

    it('POST /api/customers → 201', async () => {
      await createCustomer(supervisorToken, { name: 'E2E Supervisor Created' }).expect(201);
    });

    it('PATCH .../status to ARCHIVED → 403', async () => {
      const created = await createCustomer(supervisorToken, {
        name: 'E2E Supervisor Archive Attempt',
      }).expect(201);

      const res = await request(server())
        .patch(`/api/customers/${created.body.id}/status`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ status: 'ARCHIVED' })
        .expect(403);

      expect(res.body.message).toContain('customers:archive');
    });

    it('restoring an already-archived customer → 403', async () => {
      await request(server())
        .patch(`/api/customers/${archivedTargetId}/status`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ status: 'ACTIVE' })
        .expect(403);
    });
  });

  describe('a customer-role account', () => {
    it('GET /api/customers → 403', async () => {
      const customerUser = await createUser(adminToken, { roleKeys: ['customer'] }).expect(201);
      const customerToken = await login(customerUser.body.email, FIXTURE_PASSWORD);

      await request(server())
        .get('/api/customers')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('no password leak', () => {
    it('JSON.stringify of a customer with an assigned agent contains neither passwordHash nor scrypt$', async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);

      const res = await createCustomer(adminToken, {
        name: 'E2E No Leak',
        assignedAgentId: agent.body.id,
      }).expect(201);

      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain('passwordHash');
      expect(serialised).not.toContain('scrypt$');
    });
  });

  describe('list sorting', () => {
    it('?sort=createdAt&order=desc puts the most recently created fixture customer first', async () => {
      await createCustomer(adminToken, { name: 'E2E Sort Older' }).expect(201);
      const newest = await createCustomer(adminToken, { name: 'E2E Sort Newest' }).expect(201);

      const res = await request(server())
        .get('/api/customers?sort=createdAt&order=desc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items[0].id).toBe(newest.body.id);
    });
  });
});
