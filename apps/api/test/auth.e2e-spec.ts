import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { REFRESH_COOKIE_NAME } from '../src/auth/auth.cookie';

const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe_Dev_Only_1';

function toArray(setCookieHeader: string | string[] | undefined): string[] {
  if (!setCookieHeader) return [];
  return Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
}

function extractCookieValue(setCookieHeader: string | string[] | undefined, name: string): string {
  const raw = toArray(setCookieHeader).find((entry) => entry.startsWith(`${name}=`));

  if (!raw) {
    throw new Error(`Cookie ${name} not found in Set-Cookie header`);
  }

  return raw.split(';')[0].split('=')[1];
}

function findCookie(
  setCookieHeader: string | string[] | undefined,
  name: string,
): string | undefined {
  return toArray(setCookieHeader).find((entry) => entry.startsWith(`${name}=`));
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

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
      .addTag('health', 'Service and dependency health')
      .addTag('auth', 'Authentication and session management')
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function login(
    email: string = ADMIN_EMAIL,
    password: string = ADMIN_PASSWORD,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return res.body.accessToken as string;
  }

  describe('POST /api/auth/login', () => {
    it('returns 200, tokens, and a well-formed refresh cookie for correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.expiresInSeconds).toEqual(expect.any(Number));
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.refreshToken).toBeUndefined();

      const cookie = findCookie(res.headers['set-cookie'], REFRESH_COOKIE_NAME);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api/auth');
    });

    it('returns the identical message for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'definitely-wrong-password' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody-here@crm.local', password: 'whatever12' })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Invalid email or password.');
      expect(unknownEmail.body.message).toBe('Invalid email or password.');
    });

    it('returns 400 naming the extra property (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, extra: 1 })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('extra');
    });

    it('returns 400 for a malformed email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: ADMIN_PASSWORD })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 200 with identity, roles, and permissions for a valid token', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(ADMIN_EMAIL);
      expect(res.body.roles).toContain('system-administrator');
      expect(res.body.permissions).toEqual(
        expect.arrayContaining([
          'users:read',
          'users:write',
          'users:deactivate',
          'roles:read',
          'roles:assign',
          'departments:read',
          'departments:write',
          'branches:read',
          'branches:write',
          'reports:read',
        ]),
      );
    });

    it('returns 401 in the standard error envelope with no header', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me').expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toBeDefined();
      expect(res.body.error).toBeDefined();
      expect(res.body.path).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });

    it('returns 401 for garbage bearer content', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer garbage')
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the token pair, and the consumed cookie can no longer be used (reuse detection)', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      const firstCookieValue = extractCookieValue(login.headers['set-cookie'], REFRESH_COOKIE_NAME);

      const refreshed = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${firstCookieValue}`)
        .expect(200);

      expect(refreshed.body.accessToken).not.toBe(login.body.accessToken);

      const secondCookieValue = extractCookieValue(
        refreshed.headers['set-cookie'],
        REFRESH_COOKIE_NAME,
      );
      expect(secondCookieValue).not.toBe(firstCookieValue);

      // Replaying the now-consumed first cookie triggers reuse detection.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${firstCookieValue}`)
        .expect(401);

      // Reuse detection revoked every session, including the second cookie.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${secondCookieValue}`)
        .expect(401);
    });

    it('returns 401 and clears the cookie when no cookie is sent', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);

      const cleared = findCookie(res.headers['set-cookie'], REFRESH_COOKIE_NAME);
      expect(cleared).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 204, clears the cookie, and the token cannot be refreshed afterwards', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      const cookieValue = extractCookieValue(login.headers['set-cookie'], REFRESH_COOKIE_NAME);

      const logoutRes = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${cookieValue}`)
        .expect(204);

      expect(findCookie(logoutRes.headers['set-cookie'], REFRESH_COOKIE_NAME)).toBeDefined();

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=${cookieValue}`)
        .expect(401);
    });

    it('returns 204 with no cookie at all', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
    });
  });

  describe('account lockout', () => {
    afterAll(async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: null, failedLoginAttempts: 0 },
      });
    });

    it('locks the account after 5 consecutive failures, rejecting even the correct password', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: ADMIN_EMAIL, password: 'wrong-password-attempt' })
          .expect(401);
      }

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(401);
    });
  });

  describe('algorithm confusion', () => {
    it('rejects a token signed with the wrong secret', async () => {
      const forged = jwt.sign({ sub: 'user-1', email: ADMIN_EMAIL, jti: 'x' }, 'wrong-secret', {
        algorithm: 'HS256',
        expiresIn: '15m',
      });

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('rejects an alg: none token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
        'base64url',
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: 'user-1', email: ADMIN_EMAIL, jti: 'x' }),
      ).toString('base64url');
      const forged = `${header}.${payload}.`;

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });
  });

  describe('GET /api/roles', () => {
    it('as the administrator → 200 with 6 roles; system-administrator lists all ten permissions sorted; customer lists []', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${await login()}`)
        .expect(200);

      expect(res.body).toHaveLength(6);

      const systemAdministrator = res.body.find(
        (role: { key: string }) => role.key === 'system-administrator',
      );
      expect(systemAdministrator.permissions).toEqual(
        [...systemAdministrator.permissions].sort(),
      );
      expect(systemAdministrator.permissions).toEqual([
        'branches:read',
        'branches:write',
        'departments:read',
        'departments:write',
        'reports:read',
        'roles:assign',
        'roles:read',
        'users:deactivate',
        'users:read',
        'users:write',
      ]);

      const customer = res.body.find((role: { key: string }) => role.key === 'customer');
      expect(customer.permissions).toEqual([]);
    });

    it('as a support-agent → 403', async () => {
      const email = `e2e.roles.${Date.now()}@e2e.local`;
      const adminToken = await login();

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          fullName: 'E2E Roles Agent',
          password: 'Passw0rd1234',
          roleKeys: ['support-agent'],
        })
        .expect(201);

      const agentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Passw0rd1234' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${agentLogin.body.accessToken}`)
        .expect(403);

      await prisma.user.deleteMany({ where: { email } });
    });
  });

  describe('Swagger document', () => {
    it('declares the bearer security scheme and marks /api/auth/me as protected', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

      expect(res.body.components.securitySchemes.bearer).toBeDefined();
      expect(res.body.paths['/api/auth/login']).toBeDefined();
      expect(res.body.paths['/api/auth/me'].get.security).toBeDefined();
      expect(res.body.paths['/api/auth/login'].post.security).toBeUndefined();
    });
  });
});
