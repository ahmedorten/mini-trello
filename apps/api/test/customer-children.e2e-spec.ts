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

describe('Customer children — notes, attachments, interactions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let adminId: string;
  let customerId: string;

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

    const customer = await request(server())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Children Fixture' })
      .expect(201);
    customerId = customer.body.id;
  });

  afterAll(async () => {
    // Ticket.customer is onDelete: Restrict, so tickets created by the ticketId
    // filter/cross-customer tests must be removed before their customers.
    await prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
    await rm(join(UPLOAD_DIR, 'customers', customerId), { recursive: true, force: true });
  });

  describe('unknown customer', () => {
    it('every nested route with a random customerId → 404', async () => {
      const randomCustomerId = randomUUID();

      await request(server())
        .get(`/api/customers/${randomCustomerId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      await request(server())
        .get(`/api/customers/${randomCustomerId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      await request(server())
        .get(`/api/customers/${randomCustomerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('notes', () => {
    let noteId: string;
    let agentToken: string;

    beforeAll(async () => {
      const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
      agentToken = await login(agent.body.email, FIXTURE_PASSWORD);
    });

    it('POST → 201 with author populated', async () => {
      const res = await request(server())
        .post(`/api/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Called the customer, left a voicemail.' })
        .expect(201);

      noteId = res.body.id;
      expect(res.body.author).toEqual(
        expect.objectContaining({ id: adminId, email: ADMIN_EMAIL }),
      );
    });

    it('GET lists it', async () => {
      const res = await request(server())
        .get(`/api/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.some((note: { id: string }) => note.id === noteId)).toBe(true);
    });

    it('PATCH as the author → 200', async () => {
      const res = await request(server())
        .patch(`/api/customers/${customerId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Updated: reached the customer.' })
        .expect(200);

      expect(res.body.body).toBe('Updated: reached the customer.');
    });

    it('PATCH as a second user → 403', async () => {
      await request(server())
        .patch(`/api/customers/${customerId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ body: 'Hijacked' })
        .expect(403);
    });

    it('DELETE as that second user → 403', async () => {
      await request(server())
        .delete(`/api/customers/${customerId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });

    it("GET a note through another customer's id → 404", async () => {
      const other = await request(server())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Other Customer For Notes' })
        .expect(201);

      await request(server())
        .patch(`/api/customers/${other.body.id}/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Should 404' })
        .expect(404);
    });

    it("POST with body: '' → 400", async () => {
      await request(server())
        .post(`/api/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: '' })
        .expect(400);
    });

    it('DELETE as the author → 204', async () => {
      await request(server())
        .delete(`/api/customers/${customerId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  describe('interactions', () => {
    let interactionId: string;

    it('POST with a past occurredAt → 201', async () => {
      const res = await request(server())
        .post(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'PHONE',
          direction: 'OUTBOUND',
          subject: 'E2E Past Interaction',
          occurredAt: new Date(Date.now() - 60_000).toISOString(),
        })
        .expect(201);

      interactionId = res.body.id;
    });

    it('POST with occurredAt a day ahead → 400', async () => {
      await request(server())
        .post(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          subject: 'E2E Future Interaction',
          occurredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(400);
    });

    it("POST with channel: 'CARRIER_PIGEON' → 400", async () => {
      await request(server())
        .post(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'CARRIER_PIGEON',
          direction: 'OUTBOUND',
          subject: 'E2E Invalid Channel',
          occurredAt: new Date().toISOString(),
        })
        .expect(400);
    });

    it('GET returns newest-occurred first', async () => {
      const earlier = await request(server())
        .post(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'CHAT',
          direction: 'INBOUND',
          subject: 'E2E Earlier Interaction',
          occurredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      const res = await request(server())
        .get(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.map((interaction: { id: string }) => interaction.id);
      expect(ids.indexOf(interactionId)).toBeLessThan(ids.indexOf(earlier.body.id));
    });

    it('no query params returns the same body shape it returned before this story (the Story-11 contract proof)', async () => {
      const res = await request(server())
        .get(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const row = res.body.find((r: { id: string }) => r.id === interactionId);
      expect(row).toEqual(
        expect.objectContaining({
          id: interactionId,
          customerId,
          channel: 'PHONE',
          direction: 'OUTBOUND',
          subject: 'E2E Past Interaction',
        }),
      );
    });

    it('?channel=EMAIL filters', async () => {
      const emailInteraction = await request(server())
        .post(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          subject: 'E2E Email Filter Interaction',
          occurredAt: new Date().toISOString(),
        })
        .expect(201);

      const res = await request(server())
        .get(`/api/customers/${customerId}/interactions`)
        .query({ channel: 'EMAIL' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.every((r: { channel: string }) => r.channel === 'EMAIL')).toBe(true);
      expect(res.body.some((r: { id: string }) => r.id === emailInteraction.body.id)).toBe(true);
    });

    it('?ticketId= filters, an unknown ticketId returns [] not 404, and a cross-customer ticketId on POST → 400', async () => {
      const ticket = await request(server())
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId,
          subject: 'E2E Interactions Ticket Filter Fixture',
          description: 'Fixture ticket for the ticketId filter test',
        })
        .expect(201);

      const linked = await request(server())
        .post(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'CHAT',
          direction: 'OUTBOUND',
          subject: 'E2E Ticket-linked Interaction',
          occurredAt: new Date().toISOString(),
          ticketId: ticket.body.id,
        })
        .expect(201);

      const filtered = await request(server())
        .get(`/api/customers/${customerId}/interactions`)
        .query({ ticketId: ticket.body.id })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(filtered.body).toHaveLength(1);
      expect(filtered.body[0].id).toBe(linked.body.id);

      const unknownFiltered = await request(server())
        .get(`/api/customers/${customerId}/interactions`)
        .query({ ticketId: randomUUID() })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(unknownFiltered.body).toEqual([]);

      const otherCustomer = await request(server())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Cross-customer Ticket Owner' })
        .expect(201);

      await request(server())
        .post(`/api/customers/${otherCustomer.body.id}/interactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'CHAT',
          direction: 'OUTBOUND',
          subject: 'Should 400 — cross-customer ticket',
          occurredAt: new Date().toISOString(),
          ticketId: ticket.body.id,
        })
        .expect(400);
    });

    it('all eight channels are accepted on POST', async () => {
      const channels = [
        'PHONE',
        'EMAIL',
        'CHAT',
        'MEETING',
        'OTHER',
        'WHATSAPP',
        'SMS',
        'WEB_FORM',
      ];

      for (const channel of channels) {
        const res = await request(server())
          .post(`/api/customers/${customerId}/interactions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            channel,
            direction: 'OUTBOUND',
            subject: `E2E Channel ${channel}`,
            occurredAt: new Date().toISOString(),
          })
          .expect(201);

        expect(res.body.channel).toBe(channel);
      }
    });

    it('DELETE → 204', async () => {
      await request(server())
        .delete(`/api/customers/${customerId}/interactions/${interactionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('no PATCH route exists on an interaction → 404', async () => {
      await request(server())
        .patch(`/api/customers/${customerId}/interactions/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Should not exist' })
        .expect(404);
    });
  });

  describe('attachments', () => {
    let attachmentId: string;

    it("POST a PDF → 201, fileName, sizeBytes, 64-hex checksum, no storageKey", async () => {
      const buffer = Buffer.from('%PDF-1.4 test');
      const res = await request(server())
        .post(`/api/customers/${customerId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buffer, { filename: 'contract.pdf', contentType: 'application/pdf' })
        .expect(201);

      attachmentId = res.body.id;
      expect(res.body.fileName).toBe('contract.pdf');
      expect(res.body.sizeBytes).toBe(buffer.length);
      expect(res.body.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(res.body).not.toHaveProperty('storageKey');
    });

    it('POST an SVG → 400 (the SVG exclusion)', async () => {
      await request(server())
        .post(`/api/customers/${customerId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('<svg></svg>'), {
          filename: 'evil.svg',
          contentType: 'image/svg+xml',
        })
        .expect(400);
    });

    it('POST an 11 MB buffer → 413', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024, 1);

      await request(server())
        .post(`/api/customers/${customerId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' })
        .expect(413);
    });

    it('POST with no file part → 400', async () => {
      await request(server())
        .post(`/api/customers/${customerId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('POST with a traversal filename → 201, and fileName contains no /', async () => {
      const res = await request(server())
        .post(`/api/customers/${customerId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('%PDF-1.4 x'), {
          filename: '../../../evil.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.fileName).not.toContain('/');
    });

    it('GET .../content → 200, attachment disposition, nosniff, correct bytes', async () => {
      const res = await request(server())
        .get(`/api/customers/${customerId}/attachments/${attachmentId}/content`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(/^attachment;/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.text).toBe(
        '%PDF-1.4 test',
      );
    });

    it('DELETE → 204, then GET .../content → 404', async () => {
      await request(server())
        .delete(`/api/customers/${customerId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(server())
        .get(`/api/customers/${customerId}/attachments/${attachmentId}/content`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('permission block — a reporting-user (customers:read only)', () => {
    let reportingToken: string;

    beforeAll(async () => {
      const reportingUser = await createUser(adminToken, { roleKeys: ['reporting-user'] }).expect(
        201,
      );
      reportingToken = await login(reportingUser.body.email, FIXTURE_PASSWORD);
    });

    it('GET on all three collections → 200', async () => {
      await request(server())
        .get(`/api/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .expect(200);

      await request(server())
        .get(`/api/customers/${customerId}/attachments`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .expect(200);

      await request(server())
        .get(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .expect(200);
    });

    it('POST on notes → 403, naming notes:write', async () => {
      const res = await request(server())
        .post(`/api/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .send({ body: 'Should fail' })
        .expect(403);

      expect(res.body.message).toContain('notes:write');
    });

    it('POST on attachments → 403, naming attachments:write', async () => {
      const res = await request(server())
        .post(`/api/customers/${customerId}/attachments`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .attach('file', Buffer.from('%PDF-1.4 x'), {
          filename: 'x.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);

      expect(res.body.message).toContain('attachments:write');
    });

    it('POST on interactions → 403, naming interactions:write', async () => {
      const res = await request(server())
        .post(`/api/customers/${customerId}/interactions`)
        .set('Authorization', `Bearer ${reportingToken}`)
        .send({
          channel: 'PHONE',
          direction: 'OUTBOUND',
          subject: 'Should fail',
          occurredAt: new Date().toISOString(),
        })
        .expect(403);

      expect(res.body.message).toContain('interactions:write');
    });
  });
});
