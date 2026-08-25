import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Health Endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });

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
      .build();

    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
      swaggerOptions: { persistAuthorization: true },
    });

    app.enableShutdownHooks();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with correct body', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('customer-support-crm-api');
        expect(res.body.version).toBeDefined();
        expect(res.body.environment).toBeDefined();
        expect(res.body.uptimeSeconds).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
        expect(res.body.database).toBeDefined();
        expect(res.body.database.status).toBe('up');
        expect(typeof res.body.database.latencyMs).toBe('number');
        expect(res.body.database.message).toBeUndefined();
      });
  });

  it('GET /health without prefix returns 404', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });

  it('GET /api/does-not-exist returns 404 with error envelope', () => {
    return request(app.getHttpServer())
      .get('/api/does-not-exist')
      .expect(404)
      .expect((res) => {
        expect(res.body.statusCode).toBe(404);
        expect(res.body.message).toBeDefined();
        expect(res.body.error).toBeDefined();
        expect(res.body.path).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
      });
  });

  it('GET /api/docs-json returns OpenAPI document', () => {
    return request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((res) => {
        expect(res.body.paths).toBeDefined();
        expect(res.body.paths['/api/health']).toBeDefined();
      });
  });

  it('GET /api/docs-json exposes DatabaseHealthDto schema', () => {
    return request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((res) => {
        expect(res.body.components).toBeDefined();
        expect(res.body.components.schemas).toBeDefined();
        expect(res.body.components.schemas.DatabaseHealthDto).toBeDefined();
        expect(res.body.components.schemas.DatabaseHealthDto.properties).toBeDefined();
        expect(res.body.components.schemas.DatabaseHealthDto.properties.status).toBeDefined();
        expect(res.body.components.schemas.DatabaseHealthDto.properties.latencyMs).toBeDefined();
      });
  });
});
