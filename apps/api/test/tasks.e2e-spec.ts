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

describe('Agent tasks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let fixtureCustomerId: string;
  let fixtureTicketId: string;

  const server = () => app.getHttpServer();

  async function login(email: string, password: string): Promise<string> {
    const res = await request(server()).post('/api/auth/login').send({ email, password }).expect(200);

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

  function createTask(
    token: string,
    overrides: Record<string, unknown> = {},
  ): request.Test {
    return request(server())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `E2E Task ${randomUUID()}`, ...overrides });
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
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'bearer')
      .addCookieAuth('crm_refresh')
      .build();

    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
      swaggerOptions: { persistAuthorization: true },
    });

    app.enableShutdownHooks();

    await app.init();

    prisma = new PrismaClient();

    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    const customer = await request(server())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Tasks Fixture Customer ${randomUUID()}` })
      .expect(201);
    fixtureCustomerId = customer.body.id;

    const ticket = await request(server())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: fixtureCustomerId,
        subject: 'E2E Tasks Fixture Ticket',
        description: 'Fixture ticket for the tasks e2e suite',
      })
      .expect(201);
    fixtureTicketId = ticket.body.id;
  });

  afterAll(async () => {
    await prisma.agentTask.deleteMany({ where: { title: { startsWith: 'E2E ' } } });
    await prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/tasks with no token → 401', async () => {
    await request(server()).get('/api/tasks').expect(401);
  });

  describe('as the administrator', () => {
    it('full CRUD round-trip', async () => {
      const created = await createTask(adminToken, { notes: 'Follow up tomorrow' }).expect(201);
      const taskId = created.body.id;
      expect(created.body.status).toBe('OPEN');
      expect(created.body.assignee.email).toBe(ADMIN_EMAIL);

      const fetched = await request(server())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(fetched.body.id).toBe(taskId);

      const updated = await request(server())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Updated notes' })
        .expect(200);
      expect(updated.body.notes).toBe('Updated notes');

      await request(server())
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(server())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('an unknown query key → 400 (forbidNonWhitelisted)', async () => {
      await request(server())
        .get('/api/tasks')
        .query({ sortBy: 'title' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('task creation with a ticketId returns a derived customer ref', async () => {
      const res = await createTask(adminToken, { ticketId: fixtureTicketId }).expect(201);

      expect(res.body.ticket).toEqual(
        expect.objectContaining({ id: fixtureTicketId }),
      );
      expect(res.body.customer).toEqual(
        expect.objectContaining({ id: fixtureCustomerId }),
      );
    });

    it('task creation with a mismatched ticketId/customerId → 400', async () => {
      const otherCustomer = await request(server())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `E2E Other Task Customer ${randomUUID()}` })
        .expect(201);

      await createTask(adminToken, {
        ticketId: fixtureTicketId,
        customerId: otherCustomer.body.id,
      }).expect(400);
    });

    it('status round-trip OPEN → DONE → OPEN: completedAt stamped then null', async () => {
      const created = await createTask(adminToken).expect(201);
      const taskId = created.body.id;
      expect(created.body.completedAt).toBeNull();

      const done = await request(server())
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DONE' })
        .expect(200);
      expect(done.body.status).toBe('DONE');
      expect(done.body.completedAt).not.toBeNull();

      const reopened = await request(server())
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'OPEN' })
        .expect(200);
      expect(reopened.body.status).toBe('OPEN');
      expect(reopened.body.completedAt).toBeNull();
    });

    it('overdueOnly=true returns a back-dated task and not a future one', async () => {
      const overdue = await createTask(adminToken, {
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).expect(201);
      const future = await createTask(adminToken, {
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).expect(201);

      const res = await request(server())
        .get('/api/tasks')
        .query({ overdueOnly: true, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(overdue.body.id);
      expect(ids).not.toContain(future.body.id);
    });

    it('dueBefore filters out a task due after the cutoff', async () => {
      const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const before = await createTask(adminToken, {
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      }).expect(201);
      const after = await createTask(adminToken, {
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).expect(201);

      const res = await request(server())
        .get('/api/tasks')
        .query({ dueBefore: cutoff.toISOString(), pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(before.body.id);
      expect(ids).not.toContain(after.body.id);
    });
  });

  describe('permission block — a customer-role account', () => {
    let customerToken: string;

    beforeAll(async () => {
      const customerUser = await createUser(adminToken, { roleKeys: ['customer'] }).expect(201);
      customerToken = await login(customerUser.body.email, FIXTURE_PASSWORD);
    });

    it('every route → 403', async () => {
      await request(server()).get('/api/tasks').set('Authorization', `Bearer ${customerToken}`).expect(403);
      await createTask(customerToken).expect(403);
    });
  });

  describe('a support-agent fixture', () => {
    let agentToken: string;
    let agentId: string;

    beforeAll(async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentId = agent.body.id;
      agentToken = await login(agent.body.email, FIXTURE_PASSWORD);
    });

    it('own-task CRUD → 200', async () => {
      const created = await createTask(agentToken).expect(201);
      await request(server())
        .patch(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ notes: 'Own note' })
        .expect(200);
      await request(server())
        .delete(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(204);
    });

    it('scope=all → 403', async () => {
      await request(server())
        .get('/api/tasks')
        .query({ scope: 'all' })
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });

    it('assigneeId=<colleague> on list → 403; assigneeId=<own id> → 200', async () => {
      const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });

      await request(server())
        .get('/api/tasks')
        .query({ assigneeId: admin.id })
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      await request(server())
        .get('/api/tasks')
        .query({ assigneeId: agentId })
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);
    });

    it('assigneeId=<colleague> on create → 403', async () => {
      const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });

      await createTask(agentToken, { assigneeId: admin.id }).expect(403);
    });

    it('editing a colleague’s task → 403', async () => {
      const created = await createTask(adminToken).expect(201);

      await request(server())
        .patch(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ notes: 'Hijacked' })
        .expect(403);
    });

    it('editing a task a supervisor assigned to them → 200', async () => {
      const manager = await createUser(adminToken, { roleKeys: ['crm-manager'] }).expect(201);
      const managerToken = await login(manager.body.email, FIXTURE_PASSWORD);

      const created = await createTask(managerToken, { assigneeId: agentId }).expect(201);

      await request(server())
        .patch(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ notes: 'Accepted by the assignee' })
        .expect(200);
    });
  });

  describe('a crm-manager fixture', () => {
    it('creates a task for an agent, then deletes it', async () => {
      const manager = await createUser(adminToken, { roleKeys: ['crm-manager'] }).expect(201);
      const managerToken = await login(manager.body.email, FIXTURE_PASSWORD);
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);

      const created = await createTask(managerToken, { assigneeId: agent.body.id }).expect(201);
      expect(created.body.assignee.id).toBe(agent.body.id);

      await request(server())
        .delete(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(204);
    });
  });
});
