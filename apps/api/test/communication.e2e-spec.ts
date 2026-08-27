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

describe('Communication channels (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let reportingToken: string;
  let customerWithEmailId: string;
  let customerEmail: string;
  let customerWithoutEmailId: string;

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

    const reportingUser = await createUser(adminToken, { roleKeys: ['reporting-user'] }).expect(201);
    reportingToken = await login(reportingUser.body.email, FIXTURE_PASSWORD);

    customerEmail = `e2e.comms.${randomUUID()}@e2e.local`;

    const withEmail = await request(server())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Comms Fixture', email: customerEmail })
      .expect(201);
    customerWithEmailId = withEmail.body.id;

    const withoutEmail = await request(server())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Comms No Email' })
      .expect(201);
    customerWithoutEmailId = withoutEmail.body.id;
  });

  afterAll(async () => {
    await prisma.customerInteraction.deleteMany({
      where: { customerId: { in: [customerWithEmailId, customerWithoutEmailId] } },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: [customerWithEmailId, customerWithoutEmailId] } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/communication/channels with no token → 401', async () => {
    await request(server()).get('/api/communication/channels').expect(401);
  });

  it('returns exactly 8 items in CHANNEL_ORDER, every providerConfigured false', async () => {
    const res = await request(server())
      .get('/api/communication/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(8);
    expect(res.body.items.map((item: { key: string }) => item.key)).toEqual([
      'EMAIL',
      'WHATSAPP',
      'CHAT',
      'SMS',
      'WEB_FORM',
      'PHONE',
      'MEETING',
      'OTHER',
    ]);
    expect(
      res.body.items.every((item: { providerConfigured: boolean }) => item.providerConfigured === false),
    ).toBe(true);
  });

  it('every item carries the five fields Story 22 added', async () => {
    const res = await request(server())
      .get('/api/communication/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    for (const item of res.body.items) {
      expect(item).toEqual(
        expect.objectContaining({
          acceptsInbound: expect.any(Boolean),
          addressKind: expect.stringMatching(/^(email|phone|session|none)$/),
          requiresAddress: expect.any(Boolean),
          supportsSubject: expect.any(Boolean),
        }),
      );
      expect(
        item.maxBodyLength === null || typeof item.maxBodyLength === 'number',
      ).toBe(true);
    }
  });

  it('WEB_FORM is a one-way intake, SMS is a 1600-character phone channel, PHONE has no address', async () => {
    const res = await request(server())
      .get('/api/communication/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const byKey = new Map(
      res.body.items.map((item: { key: string }) => [item.key, item] as const),
    );

    expect(byKey.get('WEB_FORM')).toEqual(
      expect.objectContaining({ canRespond: false, acceptsInbound: true }),
    );
    expect(byKey.get('SMS')).toEqual(
      expect.objectContaining({ maxBodyLength: 1600, addressKind: 'phone' }),
    );
    expect(byKey.get('PHONE')).toEqual(
      expect.objectContaining({ addressKind: 'none', acceptsInbound: false }),
    );
  });

  it('a customer-role account → 403', async () => {
    const customerUser = await createUser(adminToken, { roleKeys: ['customer'] }).expect(201);
    const customerToken = await login(customerUser.body.email, FIXTURE_PASSWORD);

    await request(server())
      .get('/api/communication/channels')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  describe('POST /api/communication/messages', () => {
    it('with no token → 401', async () => {
      await request(server())
        .post('/api/communication/messages')
        .send({ customerId: customerWithEmailId, channel: 'EMAIL', body: 'Hi' })
        .expect(401);
    });

    it('as a reporting-user (no communication:send) → 403', async () => {
      await request(server())
        .post('/api/communication/messages')
        .set('Authorization', `Bearer ${reportingToken}`)
        .send({ customerId: customerWithEmailId, channel: 'EMAIL', body: 'Hi' })
        .expect(403);
    });

    it('EMAIL against a customer with an email → 201, OUTBOUND, LOGGED, lower-cased address, a thread key', async () => {
      const res = await request(server())
        .post('/api/communication/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerWithEmailId,
          channel: 'EMAIL',
          subject: 'E2E Following up',
          body: 'We are on it.',
        })
        .expect(201);

      expect(res.body).toEqual(
        expect.objectContaining({
          direction: 'OUTBOUND',
          deliveryStatus: 'LOGGED',
          channel: 'EMAIL',
          channelAddress: customerEmail.toLowerCase(),
          subject: 'E2E Following up',
        }),
      );
      expect(res.body.threadKey).toBe(`EMAIL:${customerEmail.toLowerCase()}`);
      expect(res.body.createdBy).not.toBeNull();
      // Story 22 Product rule 2: the diagnostic column is never returned.
      expect(res.body).not.toHaveProperty('metadata');
    });

    it('EMAIL against a customer with NO email → 400', async () => {
      await request(server())
        .post('/api/communication/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerId: customerWithoutEmailId, channel: 'EMAIL', body: 'We are on it.' })
        .expect(400);
    });

    it('WEB_FORM → 400: a form is a one-way intake', async () => {
      await request(server())
        .post('/api/communication/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerId: customerWithEmailId, channel: 'WEB_FORM', body: 'Hello' })
        .expect(400);
    });

    it('SMS with a 2000-character body → 400 on the channel limit, not the DTO cap', async () => {
      await request(server())
        .post('/api/communication/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerWithEmailId,
          channel: 'SMS',
          body: 'a'.repeat(2000),
          address: '+201001234567',
        })
        .expect(400);
    });

    it('an unknown top-level key → 400 (forbidNonWhitelisted; senders put extras in metadata)', async () => {
      await request(server())
        .post('/api/communication/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customerWithEmailId,
          channel: 'EMAIL',
          body: 'We are on it.',
          signature: 'abc',
        })
        .expect(400);
    });

    it('an unknown customer → 404', async () => {
      await request(server())
        .post('/api/communication/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerId: randomUUID(), channel: 'EMAIL', body: 'We are on it.' })
        .expect(404);
    });
  });

  describe('GET /api/communication/timeline', () => {
    it('with no token → 401', async () => {
      await request(server()).get('/api/communication/timeline').expect(401);
    });

    it('as an admin → 200 with items and meta', async () => {
      const res = await request(server())
        .get('/api/communication/timeline')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.meta).toEqual(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      );
    });

    it('?pageSize=1 returns one item and a total greater than 1', async () => {
      // Two more fixtures so the total is unambiguously above 1.
      for (const subject of ['E2E Timeline One', 'E2E Timeline Two']) {
        await request(server())
          .post('/api/communication/messages')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ customerId: customerWithEmailId, channel: 'EMAIL', subject, body: 'Body.' })
          .expect(201);
      }

      const res = await request(server())
        .get('/api/communication/timeline')
        .query({ pageSize: 1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta.total).toBeGreaterThan(1);
    });

    it('?channel=EMAIL returns only EMAIL rows', async () => {
      const res = await request(server())
        .get('/api/communication/timeline')
        .query({ channel: 'EMAIL', pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.every((item: { channel: string }) => item.channel === 'EMAIL')).toBe(
        true,
      );
    });

    it('?search finds a dispatched fixture by its subject', async () => {
      const res = await request(server())
        .get('/api/communication/timeline')
        .query({ search: 'E2E Following up' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThan(0);
      expect(
        res.body.items.every((item: { subject: string }) =>
          item.subject.includes('E2E Following up'),
        ),
      ).toBe(true);
    });

    it('?customerId of the other customer excludes it', async () => {
      const res = await request(server())
        .get('/api/communication/timeline')
        .query({ customerId: customerWithoutEmailId, pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        res.body.items.some((item: { subject: string }) => item.subject === 'E2E Following up'),
      ).toBe(false);
    });

    it('?page=9999 returns items: [] with a truthful meta, not a 404', async () => {
      const res = await request(server())
        .get('/api/communication/timeline')
        .query({ page: 9999 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta.page).toBe(9999);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });
  });

  describe('GET /api/communication/conversations', () => {
    it('with no token → 401', async () => {
      await request(server()).get('/api/communication/conversations').expect(401);
    });

    it('groups the dispatched fixtures into one thread with a newest lastMessage', async () => {
      const res = await request(server())
        .get('/api/communication/conversations')
        .query({ customerId: customerWithEmailId, channel: 'EMAIL', pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const thread = res.body.items.find(
        (item: { threadKey: string | null }) =>
          item.threadKey === `EMAIL:${customerEmail.toLowerCase()}`,
      );

      expect(thread).toBeDefined();
      expect(thread.customer.id).toBe(customerWithEmailId);
      expect(thread.channel).toBe('EMAIL');
      // Three dispatches landed in this thread: the first plus the two paging fixtures.
      expect(thread.messageCount).toBe(3);
      expect(thread.lastMessage).toEqual(
        expect.objectContaining({ id: expect.any(String), channel: 'EMAIL' }),
      );
      expect(thread.lastOccurredAt).toEqual(thread.lastMessage.occurredAt);
    });
  });
});
