import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe_Dev_Only_1';

/** 32+ characters, matching the @MinLength(32) Story 22 declared. */
const TEST_SECRET = 'e2e-inbound-secret-0123456789abcdef';

/**
 * Both configuration paths are exercised, so the suite says which behaviour it
 * is asserting rather than silently skipping one: a deployment with no secret
 * has no unauthenticated write path at all (503), and one with a secret gates
 * on it (401 / 201 / 200).
 *
 * ConfigModule reads process.env at module init and caches, so each describe
 * builds its own app with the variable set or cleared beforehand.
 */
async function buildApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ bufferLogs: true });

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
  app.enableShutdownHooks();

  await app.init();

  return app;
}

describe('Communication inbound ingestion (e2e)', () => {
  const originalSecret = process.env.COMMUNICATION_INBOUND_SECRET;

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.COMMUNICATION_INBOUND_SECRET;
    } else {
      process.env.COMMUNICATION_INBOUND_SECRET = originalSecret;
    }
  });

  describe('with COMMUNICATION_INBOUND_SECRET unset — the route fails CLOSED', () => {
    let app: INestApplication;

    beforeAll(async () => {
      delete process.env.COMMUNICATION_INBOUND_SECRET;
      app = await buildApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('POST /api/communication/inbound/EMAIL → 503, distinct from a wrong secret', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/communication/inbound/EMAIL')
        .send({ body: 'Hello.' })
        .expect(503);

      expect(res.body.message).toContain('not configured');
    });

    it('even a well-formed secret header → 503: there is nothing to compare against', async () => {
      await request(app.getHttpServer())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send({ body: 'Hello.' })
        .expect(503);
    });
  });

  describe('with COMMUNICATION_INBOUND_SECRET set', () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    let adminToken: string;
    let customerId: string;
    let customerEmail: string;

    const server = () => app.getHttpServer();

    beforeAll(async () => {
      process.env.COMMUNICATION_INBOUND_SECRET = TEST_SECRET;
      app = await buildApp();
      prisma = new PrismaClient();

      const login = await request(server())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);
      adminToken = login.body.accessToken as string;

      customerEmail = `e2e.inbound.${randomUUID()}@e2e.local`;

      const customer = await request(server())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Inbound Fixture', email: customerEmail })
        .expect(201);
      customerId = customer.body.id;
    });

    afterAll(async () => {
      await prisma.customerInteraction.deleteMany({ where: { customerId } });
      await prisma.customer.delete({ where: { id: customerId } });
      await prisma.$disconnect();
      await app.close();
    });

    it('no secret header → 401', async () => {
      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .send({ address: customerEmail, body: 'Hello.' })
        .expect(401);
    });

    it('a wrong secret of the same length → 401', async () => {
      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', 'x'.repeat(TEST_SECRET.length))
        .send({ address: customerEmail, body: 'Hello.' })
        .expect(401);
    });

    it('a wrong secret of a different length → 401 (timingSafeEqual needs equal buffers)', async () => {
      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', 'short')
        .send({ address: customerEmail, body: 'Hello.' })
        .expect(401);
    });

    it('an address matching a customer → 201, INBOUND, RECEIVED, createdBy null', async () => {
      const res = await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send({
          address: customerEmail,
          subject: 'E2E Inbound One',
          body: 'Please call me.',
          externalId: 'e2e-inbound-1',
          metadata: { provider: 'test', nested: { retries: 0 } },
        })
        .expect(201);

      expect(res.body).toEqual(
        expect.objectContaining({
          customerId,
          channel: 'EMAIL',
          direction: 'INBOUND',
          deliveryStatus: 'RECEIVED',
          subject: 'E2E Inbound One',
          channelAddress: customerEmail.toLowerCase(),
          externalId: 'e2e-inbound-1',
          createdBy: null,
        }),
      );
      // The provider payload is stored for diagnosis and never returned.
      expect(res.body).not.toHaveProperty('metadata');
    });

    it('the identical body again → 200 with the same id, and nothing written', async () => {
      const before = await prisma.customerInteraction.count({ where: { customerId } });

      const res = await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send({
          address: customerEmail,
          subject: 'E2E Inbound One',
          body: 'Please call me.',
          externalId: 'e2e-inbound-1',
        })
        .expect(200);

      const stored = await prisma.customerInteraction.findFirstOrThrow({
        where: { customerId, externalId: 'e2e-inbound-1' },
        select: { id: true },
      });

      expect(res.body.id).toBe(stored.id);
      // The @Res({ passthrough: true }) check: the 200 body is still JSON with
      // the same shape as the 201.
      expect(res.body).toEqual(
        expect.objectContaining({
          direction: 'INBOUND',
          deliveryStatus: 'RECEIVED',
          createdBy: null,
        }),
      );
      expect(await prisma.customerInteraction.count({ where: { customerId } })).toBe(before);
    });

    it('a payload with no externalId is never deduplicated', async () => {
      const body = { customerId, subject: 'E2E Inbound Twice', body: 'Same text.' };

      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send(body)
        .expect(201);

      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send(body)
        .expect(201);

      expect(
        await prisma.customerInteraction.count({
          where: { customerId, subject: 'E2E Inbound Twice' },
        }),
      ).toBe(2);
    });

    it('an unmatched address → 404', async () => {
      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send({ address: `nobody.${randomUUID()}@e2e.local`, body: 'Hello.' })
        .expect(404);
    });

    it('POST .../PHONE → 400: the channel does not accept inbound messages', async () => {
      await request(server())
        .post('/api/communication/inbound/PHONE')
        .set('x-communication-secret', TEST_SECRET)
        .send({ customerId, body: 'Hello.' })
        .expect(400);
    });

    it('POST .../CHAT with no customerId → 400: no customer record holds a session id', async () => {
      await request(server())
        .post('/api/communication/inbound/CHAT')
        .set('x-communication-secret', TEST_SECRET)
        .send({ address: 'session-abc', body: 'Hello.' })
        .expect(400);
    });

    it('POST .../NOT_A_CHANNEL → 400 listing the valid values', async () => {
      const res = await request(server())
        .post('/api/communication/inbound/NOT_A_CHANNEL')
        .set('x-communication-secret', TEST_SECRET)
        .send({ customerId, body: 'Hello.' })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('EMAIL');
    });

    it('an unknown top-level key → 400; senders put extra data in metadata', async () => {
      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send({ customerId, body: 'Hello.', signature: 'abc' })
        .expect(400);
    });

    it('an occurredAt ten minutes in the future → 400 (the five-minute skew guard applies here too)', async () => {
      await request(server())
        .post('/api/communication/inbound/EMAIL')
        .set('x-communication-secret', TEST_SECRET)
        .send({
          customerId,
          body: 'Hello.',
          occurredAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .expect(400);
    });
  });
});
