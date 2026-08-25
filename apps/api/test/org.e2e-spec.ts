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

describe('Departments & Branches (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;

  const server = () => app.getHttpServer();

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

    const login = await request(server())
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.department.deleteMany({ where: { key: { startsWith: 'e2e-' } } });
    await prisma.branch.deleteMany({ where: { key: { startsWith: 'e2e-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('departments', () => {
    it('GET /api/departments as the administrator → 200 with the two seeded rows', async () => {
      const res = await request(server())
        .get('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const keys = res.body.map((row: { key: string }) => row.key);
      expect(keys).toEqual(expect.arrayContaining(['customer-support', 'operations']));
    });

    it("POST /api/departments with { key: 'e2e-dept', name: 'E2E' } → 201", async () => {
      const res = await request(server())
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'e2e-dept', name: 'E2E' })
        .expect(201);

      expect(res.body.key).toBe('e2e-dept');
      expect(res.body.isActive).toBe(true);
    });

    it('POST /api/departments with the same key again → 409', async () => {
      await request(server())
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'e2e-dept', name: 'E2E Duplicate' })
        .expect(409);
    });

    it("POST /api/departments with key: 'Not Valid' → 400", async () => {
      await request(server())
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'Not Valid', name: 'Bad Key' })
        .expect(400);
    });

    it("PATCH /api/departments/:id with { name: 'Renamed' } → 200", async () => {
      const department = await prisma.department.findUniqueOrThrow({
        where: { key: 'e2e-dept' },
      });

      const res = await request(server())
        .patch(`/api/departments/${department.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Renamed' })
        .expect(200);

      expect(res.body.name).toBe('Renamed');
      expect(res.body.key).toBe('e2e-dept');
    });

    it("PATCH /api/departments/:id with { key: 'other' } → 400 (key is immutable)", async () => {
      const department = await prisma.department.findUniqueOrThrow({
        where: { key: 'e2e-dept' },
      });

      await request(server())
        .patch(`/api/departments/${department.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'other' })
        .expect(400);
    });
  });

  describe('branches', () => {
    it('GET /api/branches as the administrator → 200 with the seeded row', async () => {
      const res = await request(server())
        .get('/api/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const keys = res.body.map((row: { key: string }) => row.key);
      expect(keys).toContain('head-office');
    });

    it("POST /api/branches with { key: 'e2e-branch', name: 'E2E', city: 'Giza' } → 201", async () => {
      const res = await request(server())
        .post('/api/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'e2e-branch', name: 'E2E', city: 'Giza' })
        .expect(201);

      expect(res.body.key).toBe('e2e-branch');
      expect(res.body.city).toBe('Giza');
      expect(res.body.isActive).toBe(true);
    });

    it('POST /api/branches with the same key again → 409', async () => {
      await request(server())
        .post('/api/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'e2e-branch', name: 'E2E Duplicate' })
        .expect(409);
    });

    it("POST /api/branches with key: 'Not Valid' → 400", async () => {
      await request(server())
        .post('/api/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'Not Valid', name: 'Bad Key' })
        .expect(400);
    });

    it("PATCH /api/branches/:id with { name: 'Renamed', city: 'Alexandria' } → 200, city round-trips", async () => {
      const branch = await prisma.branch.findUniqueOrThrow({ where: { key: 'e2e-branch' } });

      const res = await request(server())
        .patch(`/api/branches/${branch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Renamed', city: 'Alexandria' })
        .expect(200);

      expect(res.body.name).toBe('Renamed');
      expect(res.body.city).toBe('Alexandria');
      expect(res.body.key).toBe('e2e-branch');
    });

    it("PATCH /api/branches/:id with { key: 'other' } → 400 (key is immutable)", async () => {
      const branch = await prisma.branch.findUniqueOrThrow({ where: { key: 'e2e-branch' } });

      await request(server())
        .patch(`/api/branches/${branch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'other' })
        .expect(400);
    });
  });
});
