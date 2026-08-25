import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
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
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './var/uploads';

describe('Ticket children — comments, attachments, history (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let adminId: string;
  let ticketId: string;

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
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    adminId = admin.id;

    const customer = await request(server())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Ticket Children Fixture Customer' })
      .expect(201);

    const ticket = await request(server())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.body.id,
        subject: 'E2E Ticket Children Fixture',
        description: 'Fixture for comments/attachments/history e2e',
      })
      .expect(201);
    ticketId = ticket.body.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
    await rm(join(UPLOAD_DIR, 'tickets', ticketId), { recursive: true, force: true });
  });

  describe('unknown ticket', () => {
    it('every nested route with a random ticketId → 404', async () => {
      const randomTicketId = randomUUID();

      await request(server())
        .get(`/api/tickets/${randomTicketId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      await request(server())
        .get(`/api/tickets/${randomTicketId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      await request(server())
        .get(`/api/tickets/${randomTicketId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('comments', () => {
    let commentId: string;
    let agentToken: string;

    beforeAll(async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentToken = await login(agent.body.email, FIXTURE_PASSWORD);
    });

    it('POST → 201 with author populated', async () => {
      const res = await request(server())
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Called the customer, left a voicemail.' })
        .expect(201);

      commentId = res.body.id;
      expect(res.body.author).toEqual(expect.objectContaining({ id: adminId, email: ADMIN_EMAIL }));
    });

    it('GET lists it', async () => {
      const res = await request(server())
        .get(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.some((comment: { id: string }) => comment.id === commentId)).toBe(true);
    });

    it('PATCH as the author → 200', async () => {
      const res = await request(server())
        .patch(`/api/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Updated: reached the customer.' })
        .expect(200);

      expect(res.body.body).toBe('Updated: reached the customer.');
    });

    it('PATCH as a second user → 403 (author-only, even for tickets:manage holders)', async () => {
      await request(server())
        .patch(`/api/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ body: 'Hijacked' })
        .expect(403);
    });

    it("POST with body: '' → 400", async () => {
      await request(server())
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: '' })
        .expect(400);
    });

    it('support-agent blocked from deleting another agent\'s comment; crm-manager succeeds', async () => {
      const created = await request(server())
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Admin-authored comment for deletion test' })
        .expect(201);

      await request(server())
        .delete(`/api/tickets/${ticketId}/comments/${created.body.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      const manager = await createUser(adminToken, { roleKeys: ['crm-manager'] }).expect(201);
      const managerToken = await login(manager.body.email, FIXTURE_PASSWORD);

      await request(server())
        .delete(`/api/tickets/${ticketId}/comments/${created.body.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(204);
    });

    it('DELETE as the author → 204', async () => {
      await request(server())
        .delete(`/api/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  describe('attachments', () => {
    let attachmentId: string;
    let agentToken: string;

    beforeAll(async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentToken = await login(agent.body.email, FIXTURE_PASSWORD);
    });

    it('POST a PNG → 201, fileName, sizeBytes, 64-hex checksum, no storageKey', async () => {
      const buffer = Buffer.from('fake png bytes');
      const res = await request(server())
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buffer, { filename: 'screenshot.png', contentType: 'image/png' })
        .expect(201);

      attachmentId = res.body.id;
      expect(res.body.fileName).toBe('screenshot.png');
      expect(res.body.sizeBytes).toBe(buffer.length);
      expect(res.body.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(res.body).not.toHaveProperty('storageKey');
    });

    it('POST an SVG → 400 (the SVG exclusion)', async () => {
      await request(server())
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('<svg></svg>'), { filename: 'evil.svg', contentType: 'image/svg+xml' })
        .expect(400);
    });

    it('POST an 11 MB buffer → 413', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024, 1);

      await request(server())
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' })
        .expect(413);
    });

    it('POST with no file part → 400', async () => {
      await request(server())
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('GET .../content → 200, attachment disposition, nosniff, correct bytes', async () => {
      const res = await request(server())
        .get(`/api/tickets/${ticketId}/attachments/${attachmentId}/content`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(/^attachment;/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.text).toBe('fake png bytes');
    });

    it('support-agent blocked from deleting another agent\'s attachment; crm-manager succeeds', async () => {
      const created = await request(server())
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('admin uploaded bytes'), {
          filename: 'admin-file.png',
          contentType: 'image/png',
        })
        .expect(201);

      await request(server())
        .delete(`/api/tickets/${ticketId}/attachments/${created.body.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      const manager = await createUser(adminToken, { roleKeys: ['crm-manager'] }).expect(201);
      const managerToken = await login(manager.body.email, FIXTURE_PASSWORD);

      await request(server())
        .delete(`/api/tickets/${ticketId}/attachments/${created.body.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(204);
    });

    it('DELETE → 204, then GET .../content → 404', async () => {
      await request(server())
        .delete(`/api/tickets/${ticketId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(server())
        .get(`/api/tickets/${ticketId}/attachments/${attachmentId}/content`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('history', () => {
    it('GET returns rows after a priority change and a status change, with matching field/oldValue/newValue', async () => {
      const created = await request(server())
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: (
            await request(server())
              .post('/api/customers')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({ name: 'E2E History Fixture Customer' })
              .expect(201)
          ).body.id,
          subject: 'E2E History Fixture Ticket',
          description: 'History fixture',
        })
        .expect(201);
      const historyTicketId = created.body.id;

      await request(server())
        .patch(`/api/tickets/${historyTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'HIGH' })
        .expect(200);

      await request(server())
        .patch(`/api/tickets/${historyTicketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      const res = await request(server())
        .get(`/api/tickets/${historyTicketId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const priorityEntry = res.body.find((row: { field: string }) => row.field === 'priority');
      const statusEntry = res.body.find((row: { field: string }) => row.field === 'status');

      expect(priorityEntry).toEqual(
        expect.objectContaining({ field: 'priority', oldValue: 'MEDIUM', newValue: 'HIGH' }),
      );
      expect(statusEntry).toEqual(
        expect.objectContaining({ field: 'status', oldValue: 'OPEN', newValue: 'IN_PROGRESS' }),
      );
    });

    it('GET on a brand-new ticket with no changes → 200 with []', async () => {
      const customer = await request(server())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Empty History Fixture Customer' })
        .expect(201);

      const ticket = await request(server())
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customer.body.id,
          subject: 'E2E Empty History Ticket',
          description: 'No changes yet',
        })
        .expect(201);

      const res = await request(server())
        .get(`/api/tickets/${ticket.body.id}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('POST/PATCH/DELETE on /tickets/:id/history all 404 (no such route)', async () => {
      await request(server())
        .post(`/api/tickets/${ticketId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(404);

      await request(server())
        .patch(`/api/tickets/${ticketId}/history/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(404);

      await request(server())
        .delete(`/api/tickets/${ticketId}/history/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('permission block — a reporting-user (tickets:read only)', () => {
    let reportingToken: string;

    beforeAll(async () => {
      const reportingUser = await createUser(adminToken, { roleKeys: ['reporting-user'] }).expect(201);
      reportingToken = await login(reportingUser.body.email, FIXTURE_PASSWORD);
    });

    it('GET on all three collections → 200', async () => {
      await request(server())
        .get(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .expect(200);

      await request(server())
        .get(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .expect(200);

      await request(server())
        .get(`/api/tickets/${ticketId}/history`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .expect(200);
    });

    it('POST on comments → 403, naming ticket-comments:write', async () => {
      const res = await request(server())
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .send({ body: 'Should fail' })
        .expect(403);

      expect(res.body.message).toContain('ticket-comments:write');
    });

    it('POST on attachments → 403, naming ticket-attachments:write', async () => {
      const res = await request(server())
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .attach('file', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' })
        .expect(403);

      expect(res.body.message).toContain('ticket-attachments:write');
    });
  });
});
