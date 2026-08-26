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

describe('Quick replies (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let agentToken: string;

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

    const agent = await createUser(adminToken, { roleKeys: ['support-agent'] }).expect(201);
    agentToken = await login(agent.body.email, FIXTURE_PASSWORD);
  });

  afterAll(async () => {
    await prisma.quickReply.deleteMany({ where: { key: { startsWith: 'e2e-' } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/quick-replies with no token → 401', async () => {
    await request(server()).get('/api/quick-replies').expect(401);
  });

  it('the seeded catalogue is readable by a support-agent', async () => {
    const res = await request(server())
      .get('/api/quick-replies')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((reply: { isActive: boolean }) => reply.isActive)).toBe(true);
  });

  it('?locale=ar returns the seeded Arabic rows', async () => {
    const res = await request(server())
      .get('/api/quick-replies')
      .query({ locale: 'ar' })
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((reply: { locale: string }) => reply.locale === 'ar')).toBe(true);
  });

  it('?channel=SMS includes both the SMS reply and a channel: null reply', async () => {
    const res = await request(server())
      .get('/api/quick-replies')
      .query({ channel: 'SMS', locale: 'en' })
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(res.body.some((reply: { channel: string | null }) => reply.channel === 'SMS')).toBe(true);
    expect(res.body.some((reply: { channel: string | null }) => reply.channel === null)).toBe(true);
  });

  it('POST as a support-agent → 403', async () => {
    await request(server())
      .post('/api/quick-replies')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ key: `e2e-${randomUUID()}`, locale: 'en', title: 'Test', body: 'Body' })
      .expect(403);
  });

  describe('write operations as the administrator', () => {
    let replyId: string;
    const key = `e2e-${randomUUID()}`;

    it('POST → 201', async () => {
      const res = await request(server())
        .post('/api/quick-replies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key, locale: 'en', title: 'E2E Reply', body: 'E2E body text' })
        .expect(201);

      replyId = res.body.id;
      expect(res.body.key).toBe(key);
      expect(res.body.isActive).toBe(true);
    });

    it('duplicate [key, locale] → 409', async () => {
      await request(server())
        .post('/api/quick-replies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key, locale: 'en', title: 'Duplicate', body: 'Body' })
        .expect(409);
    });

    it('PATCH cannot change key', async () => {
      const res = await request(server())
        .patch(`/api/quick-replies/${replyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'E2E Reply Updated' })
        .expect(200);

      expect(res.body.key).toBe(key);
      expect(res.body.title).toBe('E2E Reply Updated');
    });

    it('includeInactive=true as a support-agent returns only active rows (silent ignore, not 403)', async () => {
      await request(server())
        .patch(`/api/quick-replies/${replyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      const asAgent = await request(server())
        .get('/api/quick-replies')
        .query({ includeInactive: true })
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);
      expect(asAgent.body.some((reply: { id: string }) => reply.id === replyId)).toBe(false);

      const asAdmin = await request(server())
        .get('/api/quick-replies')
        .query({ includeInactive: true })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(asAdmin.body.some((reply: { id: string }) => reply.id === replyId)).toBe(true);
    });

    it('DELETE → 204', async () => {
      await request(server())
        .delete(`/api/quick-replies/${replyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(server())
        .get(`/api/quick-replies/${replyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
