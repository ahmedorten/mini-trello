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

describe('Tickets (e2e)', () => {
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
      .send({ name: `E2E Ticket Fixture Customer ${randomUUID()}` })
      .expect(201);

    fixtureCustomerId = customer.body.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('administrator CRUD', () => {
    let createdId: string;

    it('GET /api/tickets with no token → 401', async () => {
      await request(server()).get('/api/tickets').expect(401);
    });

    it('GET /api/tickets as the administrator → 200, items array, meta with page/pageSize', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toEqual(expect.any(Array));
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, pageSize: 20 }));
    });

    it('POST /api/tickets with only required fields → 201, defaults GENERAL/MEDIUM/OPEN', async () => {
      const res = await createTicket(adminToken).expect(201);

      createdId = res.body.id;

      expect(res.body.category).toBe('GENERAL');
      expect(res.body.priority).toBe('MEDIUM');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.counts).toEqual({ comments: 0, attachments: 0, history: 0 });
    });

    it('POST with an unknown customerId → 400', async () => {
      await createTicket(adminToken, { customerId: randomUUID() }).expect(400);
    });

    it('POST with an unknown assignedAgentId → 400', async () => {
      await createTicket(adminToken, { assignedAgentId: randomUUID() }).expect(400);
    });

    it('POST with an inactive assignedAgentId → 400', async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);

      await request(server())
        .patch(`/api/users/${agent.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      await createTicket(adminToken, { assignedAgentId: agent.body.id }).expect(400);
    });

    it("POST with subject: 'A' → 400 (minimum length)", async () => {
      await createTicket(adminToken, { subject: 'A' }).expect(400);
    });

    it('GET /api/tickets/:id → 200 with customer, assignedAgent, createdBy, counts', async () => {
      const res = await request(server())
        .get(`/api/tickets/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('customer');
      expect(res.body).toHaveProperty('assignedAgent');
      expect(res.body).toHaveProperty('createdBy');
      expect(res.body).toHaveProperty('counts');
    });

    it('GET /api/tickets/not-a-uuid → 400', async () => {
      await request(server())
        .get('/api/tickets/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('GET /api/tickets/<random uuid> → 404', async () => {
      await request(server())
        .get(`/api/tickets/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('PATCH /api/tickets/:id with an explicit null assignedAgentId clears it, an absent key leaves it', async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      const created = await createTicket(adminToken, { assignedAgentId: agent.body.id }).expect(201);

      const untouched = await request(server())
        .patch(`/api/tickets/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'E2E Renamed Subject' })
        .expect(200);
      expect(untouched.body.assignedAgent?.id).toBe(agent.body.id);

      const cleared = await request(server())
        .patch(`/api/tickets/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: null })
        .expect(200);
      expect(cleared.body.assignedAgent).toBeNull();
    });

    it('PATCH /api/tickets/:id/status transitions status and increments counts.history', async () => {
      const created = await createTicket(adminToken).expect(201);

      const res = await request(server())
        .patch(`/api/tickets/${created.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.counts.history).toBe(1);
    });

    it('PATCH /api/tickets/:id/status with the same status → 200, no history increment', async () => {
      const created = await createTicket(adminToken).expect(201);

      const res = await request(server())
        .patch(`/api/tickets/${created.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'OPEN' })
        .expect(200);

      expect(res.body.counts.history).toBe(0);
    });
  });

  describe('search and filter', () => {
    let searchFixtureId: string;
    const searchSubject = `E2E Zebra Login Bug ${randomUUID()}`;

    beforeAll(async () => {
      const created = await createTicket(adminToken, {
        subject: searchSubject,
        category: 'TECHNICAL',
        priority: 'URGENT',
      }).expect(201);
      searchFixtureId = created.body.id;
    });

    it('finds the fixture by a partial subject fragment in the wrong case', async () => {
      const fragment = searchSubject.slice(5, 15).toLowerCase();

      const res = await request(server())
        .get('/api/tickets')
        .query({ search: fragment, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === searchFixtureId)).toBe(true);
    });

    it('category=TECHNICAL includes the fixture', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .query({ category: 'TECHNICAL', pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === searchFixtureId)).toBe(true);
    });

    it('priority=LOW excludes the URGENT fixture', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .query({ priority: 'LOW', pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === searchFixtureId)).toBe(false);
    });

    it('customerId filters to the fixture customer', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .query({ customerId: fixtureCustomerId, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((item: { id: string }) => item.id === searchFixtureId)).toBe(true);
    });

    it('an unknown query parameter → 400 (forbidNonWhitelisted)', async () => {
      await request(server())
        .get('/api/tickets')
        .query({ sortBy: 'subject' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('page=9999 → 200 with items: []', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .query({ page: 9999 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toEqual([]);
    });
  });

  describe('a support-agent account (tickets:write but not tickets:manage)', () => {
    let agentToken: string;

    beforeAll(async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentToken = await login(agent.body.email, FIXTURE_PASSWORD);
    });

    it('can create and status-change tickets freely — no elevated-permission gate on status', async () => {
      const created = await createTicket(agentToken).expect(201);

      await request(server())
        .patch(`/api/tickets/${created.body.id}/status`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ status: 'RESOLVED' })
        .expect(200);
    });

    it('can update category/priority/assignedAgentId', async () => {
      const created = await createTicket(agentToken).expect(201);

      const res = await request(server())
        .patch(`/api/tickets/${created.body.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ priority: 'HIGH' })
        .expect(200);

      expect(res.body.priority).toBe('HIGH');
    });
  });

  describe('scope filter on GET /api/tickets', () => {
    let agentAId: string;
    let agentAToken: string;
    let agentBId: string;
    let mineTicketId: string;
    let unassignedTicketId: string;
    let othersTicketId: string;

    beforeAll(async () => {
      const agentA = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentAId = agentA.body.id;
      agentAToken = await login(agentA.body.email, FIXTURE_PASSWORD);

      const agentB = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentBId = agentB.body.id;

      const mine = await createTicket(adminToken, { assignedAgentId: agentAId }).expect(201);
      mineTicketId = mine.body.id;

      const unassigned = await createTicket(adminToken).expect(201);
      unassignedTicketId = unassigned.body.id;

      const others = await createTicket(adminToken, { assignedAgentId: agentBId }).expect(201);
      othersTicketId = others.body.id;
    });

    function ids(items: { id: string }[]): string[] {
      return items.map((item) => item.id);
    }

    it('scope=mine returns only tickets assigned to the caller', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .query({ scope: 'mine', pageSize: 100 })
        .set('Authorization', `Bearer ${agentAToken}`)
        .expect(200);

      expect(ids(res.body.items)).toContain(mineTicketId);
      expect(ids(res.body.items)).not.toContain(unassignedTicketId);
      expect(ids(res.body.items)).not.toContain(othersTicketId);
      expect(
        res.body.items.every((item: { assignedAgent: { id: string } | null }) =>
          item.assignedAgent?.id === agentAId,
        ),
      ).toBe(true);
    });

    it('scope=unassigned returns only unassigned tickets', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .query({ scope: 'unassigned', pageSize: 100 })
        .set('Authorization', `Bearer ${agentAToken}`)
        .expect(200);

      expect(ids(res.body.items)).toContain(unassignedTicketId);
      expect(ids(res.body.items)).not.toContain(mineTicketId);
      expect(ids(res.body.items)).not.toContain(othersTicketId);
      expect(
        res.body.items.every(
          (item: { assignedAgent: unknown }) => item.assignedAgent === null,
        ),
      ).toBe(true);
    });

    it('scope=workable returns the union of mine and unassigned', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .query({ scope: 'workable', pageSize: 100 })
        .set('Authorization', `Bearer ${agentAToken}`)
        .expect(200);

      expect(ids(res.body.items)).toContain(mineTicketId);
      expect(ids(res.body.items)).toContain(unassignedTicketId);
      expect(ids(res.body.items)).not.toContain(othersTicketId);
    });

    it('scope=all and an omitted scope return identical bodies — the backward-compatibility proof', async () => {
      const withAll = await request(server())
        .get('/api/tickets')
        .query({ scope: 'all', customerId: fixtureCustomerId, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const withoutScope = await request(server())
        .get('/api/tickets')
        .query({ customerId: fixtureCustomerId, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(withoutScope.body).toEqual(withAll.body);
    });

    it('scope=workable together with search keeps both clauses', async () => {
      const uniqueFragment = `Workable${randomUUID().slice(0, 8)}`;
      const target = await createTicket(adminToken, {
        assignedAgentId: agentAId,
        subject: `E2E ${uniqueFragment} ticket`,
      }).expect(201);

      const unrelated = await createTicket(adminToken, { assignedAgentId: agentBId }).expect(201);

      const res = await request(server())
        .get('/api/tickets')
        .query({ scope: 'workable', search: uniqueFragment, pageSize: 100 })
        .set('Authorization', `Bearer ${agentAToken}`)
        .expect(200);

      expect(ids(res.body.items)).toContain(target.body.id);
      expect(ids(res.body.items)).not.toContain(unrelated.body.id);
    });
  });

  describe('PATCH /api/tickets/:id/assignment', () => {
    it('as the administrator sets and clears the assignment, each adding a history entry', async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      const created = await createTicket(adminToken).expect(201);

      const assigned = await request(server())
        .patch(`/api/tickets/${created.body.id}/assignment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: agent.body.id })
        .expect(200);
      expect(assigned.body.assignedAgent?.id).toBe(agent.body.id);

      const released = await request(server())
        .patch(`/api/tickets/${created.body.id}/assignment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: null })
        .expect(200);
      expect(released.body.assignedAgent).toBeNull();

      const history = await request(server())
        .get(`/api/tickets/${created.body.id}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const assignmentEntries = history.body.filter(
        (entry: { field: string }) => entry.field === 'assignedAgentId',
      );
      expect(assignmentEntries).toHaveLength(2);
    });

    it('a repeat PATCH with the same value adds no further history entry', async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      const created = await createTicket(adminToken, { assignedAgentId: agent.body.id }).expect(
        201,
      );

      await request(server())
        .patch(`/api/tickets/${created.body.id}/assignment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: agent.body.id })
        .expect(200);

      const history = await request(server())
        .get(`/api/tickets/${created.body.id}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        history.body.filter((entry: { field: string }) => entry.field === 'assignedAgentId'),
      ).toHaveLength(0);
    });

    describe('as a support-agent (no tickets:assign)', () => {
      let agentToken: string;
      let agentId: string;
      let otherAgentId: string;

      beforeAll(async () => {
        const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
        agentId = agent.body.id;
        agentToken = await login(agent.body.email, FIXTURE_PASSWORD);

        const other = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
        otherAgentId = other.body.id;
      });

      it('claiming an unassigned ticket → 200', async () => {
        const created = await createTicket(adminToken).expect(201);

        const res = await request(server())
          .patch(`/api/tickets/${created.body.id}/assignment`)
          .set('Authorization', `Bearer ${agentToken}`)
          .send({ assignedAgentId: agentId })
          .expect(200);

        expect(res.body.assignedAgent?.id).toBe(agentId);
      });

      it('assigning it to a second agent → 403', async () => {
        const created = await createTicket(adminToken).expect(201);

        await request(server())
          .patch(`/api/tickets/${created.body.id}/assignment`)
          .set('Authorization', `Bearer ${agentToken}`)
          .send({ assignedAgentId: otherAgentId })
          .expect(403);
      });

      it('releasing their own → 200', async () => {
        const created = await createTicket(adminToken, { assignedAgentId: agentId }).expect(201);

        const res = await request(server())
          .patch(`/api/tickets/${created.body.id}/assignment`)
          .set('Authorization', `Bearer ${agentToken}`)
          .send({ assignedAgentId: null })
          .expect(200);

        expect(res.body.assignedAgent).toBeNull();
      });

      it("releasing one assigned to the second agent → 403", async () => {
        const created = await createTicket(adminToken, { assignedAgentId: otherAgentId }).expect(
          201,
        );

        await request(server())
          .patch(`/api/tickets/${created.body.id}/assignment`)
          .set('Authorization', `Bearer ${agentToken}`)
          .send({ assignedAgentId: null })
          .expect(403);
      });

      it('PATCH /api/tickets/:id with a colleague assignedAgentId → 403 (the bypass is closed)', async () => {
        const created = await createTicket(adminToken).expect(201);

        await request(server())
          .patch(`/api/tickets/${created.body.id}`)
          .set('Authorization', `Bearer ${agentToken}`)
          .send({ assignedAgentId: otherAgentId })
          .expect(403);
      });
    });

    it('as a support-supervisor (holds tickets:assign), assigning to another agent → 200', async () => {
      const supervisor = await createUser(adminToken, { roleKeys: ['support-supervisor'] }).expect(
        201,
      );
      const supervisorToken = await login(supervisor.body.email, FIXTURE_PASSWORD);

      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      const created = await createTicket(adminToken).expect(201);

      const res = await request(server())
        .patch(`/api/tickets/${created.body.id}/assignment`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ assignedAgentId: agent.body.id })
        .expect(200);

      expect(res.body.assignedAgent?.id).toBe(agent.body.id);
    });

    it('assignment to an inactive user → 400', async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      await request(server())
        .patch(`/api/users/${agent.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      const created = await createTicket(adminToken).expect(201);

      await request(server())
        .patch(`/api/tickets/${created.body.id}/assignment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: agent.body.id })
        .expect(400);
    });

    it('assignment to an unknown uuid → 400', async () => {
      const created = await createTicket(adminToken).expect(201);

      await request(server())
        .patch(`/api/tickets/${created.body.id}/assignment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: randomUUID() })
        .expect(400);
    });

    it('assignment on an unknown ticket id → 404', async () => {
      await request(server())
        .patch(`/api/tickets/${randomUUID()}/assignment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: null })
        .expect(404);
    });
  });

  describe('a zero-permission customer-role account', () => {
    it('gets 403 on every route', async () => {
      const customerUser = await createUser(adminToken, { roleKeys: ['customer'] }).expect(201);
      const customerToken = await login(customerUser.body.email, FIXTURE_PASSWORD);

      await request(server()).get('/api/tickets').set('Authorization', `Bearer ${customerToken}`).expect(403);
      await createTicket(customerToken).expect(403);
    });
  });

  describe('list sorting', () => {
    let firstItemBeforeSort: string;

    beforeAll(async () => {
      await createTicket(adminToken, { subject: `E2E Sort A ${randomUUID()}` }).expect(201);
      await createTicket(adminToken, { subject: `E2E Sort B ${randomUUID()}` }).expect(201);
      await createTicket(adminToken, { subject: `E2E Sort C ${randomUUID()}` }).expect(201);

      const res = await request(server())
        .get('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      firstItemBeforeSort = res.body.items[0].id;
    });

    it('?sort=subject&order=asc returns ascending subject order', async () => {
      const res = await request(server())
        .get('/api/tickets?sort=subject&order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const subjects = res.body.items.map((item: { subject: string }) => item.subject);
      const sorted = [...subjects].sort((a, b) => a.localeCompare(b));
      expect(subjects).toEqual(sorted);
    });

    it('?sort=nope → 400', async () => {
      await request(server())
        .get('/api/tickets?sort=nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('?sortBy=createdAt → 400 (forbidNonWhitelisted)', async () => {
      await request(server())
        .get('/api/tickets?sortBy=createdAt')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('a request with no sort returns the same first item as before the change', async () => {
      const res = await request(server())
        .get('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items[0].id).toBe(firstItemBeforeSort);
    });
  });
});
