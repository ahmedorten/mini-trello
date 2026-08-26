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

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let fixtureCustomerId: string;

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

  function createTicket(
    token: string,
    overrides: Partial<{
      customerId: string;
      subject: string;
      description: string;
      category: string;
      priority: string;
      assignedAgentId: string;
    }> = {},
  ): request.Test {
    return request(server())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: fixtureCustomerId,
        subject: `E2E Ticket ${randomUUID()}`,
        description: 'E2E ticket description',
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
      .send({ name: `E2E Dashboard Fixture Customer ${randomUUID()}` })
      .expect(201);

    fixtureCustomerId = customer.body.id;
  });

  afterAll(async () => {
    // AgentTask.assignee/createdBy are onDelete: Restrict, so tasks created by
    // the tasksDueSoon test must be removed before their owning fixture users.
    await prisma.agentTask.deleteMany({ where: { title: { startsWith: 'E2E ' } } });
    await prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/dashboard/agent with no token → 401', async () => {
    await request(server()).get('/api/dashboard/agent').expect(401);
  });

  describe('as the administrator', () => {
    it('200, with every documented key, listLimit: 5, and a parseable generatedAt', async () => {
      const res = await request(server())
        .get('/api/dashboard/agent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('counts');
      expect(res.body).toHaveProperty('byStatus');
      expect(res.body).toHaveProperty('byPriority');
      expect(res.body).toHaveProperty('byCategory');
      expect(res.body).toHaveProperty('focusTickets');
      expect(res.body).toHaveProperty('overdueTickets');
      expect(res.body).toHaveProperty('unassignedTickets');
      expect(res.body).toHaveProperty('tasksDueSoon');
      expect(res.body.listLimit).toBe(5);
      expect(Number.isNaN(Date.parse(res.body.generatedAt))).toBe(false);
    });

    it('byStatus has exactly 5 entries, byPriority 4, byCategory 7 — the enum cardinalities', async () => {
      const res = await request(server())
        .get('/api/dashboard/agent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.byStatus).toHaveLength(5);
      expect(res.body.byPriority).toHaveLength(4);
      expect(res.body.byCategory).toHaveLength(7);
    });

    it('every embedded list has length <= 5', async () => {
      const res = await request(server())
        .get('/api/dashboard/agent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.focusTickets.length).toBeLessThanOrEqual(5);
      expect(res.body.overdueTickets.length).toBeLessThanOrEqual(5);
      expect(res.body.unassignedTickets.length).toBeLessThanOrEqual(5);
      expect(res.body.tasksDueSoon.length).toBeLessThanOrEqual(5);
    });

    it('scope=all and scope=unassigned both → 200', async () => {
      await request(server())
        .get('/api/dashboard/agent')
        .query({ scope: 'all' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(server())
        .get('/api/dashboard/agent')
        .query({ scope: 'unassigned' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('scope=bogus → 400', async () => {
      await request(server())
        .get('/api/dashboard/agent')
        .query({ scope: 'bogus' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('an unknown query key → 400 (forbidNonWhitelisted)', async () => {
      await request(server())
        .get('/api/dashboard/agent')
        .query({ sortBy: 'subject' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  it('as a fresh support-agent with no tickets: all counts 0, all buckets present, all lists [], tasksDueSoon: []', async () => {
    const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
    const agentToken = await login(agent.body.email, FIXTURE_PASSWORD);

    const res = await request(server())
      .get('/api/dashboard/agent')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(res.body.counts).toEqual({
      assigned: 0,
      open: 0,
      pending: 0,
      overdue: 0,
      unassigned: 0,
      resolvedLast7Days: 0,
    });
    expect(res.body.byStatus).toHaveLength(5);
    expect(res.body.byStatus.every((b: { count: number }) => typeof b.count === 'number')).toBe(
      true,
    );
    expect(res.body.focusTickets).toEqual([]);
    expect(res.body.overdueTickets).toEqual([]);
    // tasksDueSoon is [] here regardless — a brand-new agent owns no tasks, even
    // though support-agent holds tasks:read.
    expect(res.body.tasksDueSoon).toEqual([]);
  });

  it('a customer-role account → 403', async () => {
    const customerUser = await createUser(adminToken, { roleKeys: ['customer'] }).expect(201);
    const customerToken = await login(customerUser.body.email, FIXTURE_PASSWORD);

    await request(server())
      .get('/api/dashboard/agent')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('a reporting-user-role account → 200 with tasksDueSoon: []', async () => {
    const reportingUser = await createUser(adminToken, { roleKeys: ['reporting-user'] }).expect(
      201,
    );
    const reportingToken = await login(reportingUser.body.email, FIXTURE_PASSWORD);

    const res = await request(server())
      .get('/api/dashboard/agent')
      .set('Authorization', `Bearer ${reportingToken}`)
      .expect(200);

    expect(res.body.tasksDueSoon).toEqual([]);
  });

  it('after creating two open tasks for the caller, tasksDueSoon has length 2, ordered by dueAt ascending with the undated one last', async () => {
    const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
    const agentToken = await login(agent.body.email, FIXTURE_PASSWORD);

    await request(server())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        title: `E2E Task Due Soon ${randomUUID()}`,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    await request(server())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: `E2E Task No Due Date ${randomUUID()}` })
      .expect(201);

    const res = await request(server())
      .get('/api/dashboard/agent')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(res.body.tasksDueSoon).toHaveLength(2);
    expect(res.body.tasksDueSoon[0].dueAt).not.toBeNull();
    expect(res.body.tasksDueSoon[1].dueAt).toBeNull();
  });

  it('a ticket assigned to a fixture agent appears in that agent’s focusTickets and increments counts.assigned/counts.open', async () => {
    const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
    const agentToken = await login(agent.body.email, FIXTURE_PASSWORD);

    const before = await request(server())
      .get('/api/dashboard/agent')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    const created = await createTicket(adminToken, { assignedAgentId: agent.body.id }).expect(201);

    const after = await request(server())
      .get('/api/dashboard/agent')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(after.body.counts.assigned).toBe(before.body.counts.assigned + 1);
    expect(after.body.counts.open).toBe(before.body.counts.open + 1);
    expect(
      after.body.focusTickets.some((ticket: { id: string }) => ticket.id === created.body.id),
    ).toBe(true);
  });
});
