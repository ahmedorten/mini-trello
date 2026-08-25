# Story 02 — Backend API bootstrap: NestJS, validation, logging, Swagger, error handling (Story: 1)

## Prerequisites

- [Story 01 completed](01-story-workspace-scaffolding-1.md): root `package.json` with `workspaces: ["apps/*"]`, an **empty** `apps/api/` directory, `apps/api/.env.example`, `.editorconfig` with `end_of_line = lf`, and the extended `.gitignore`.
- Node.js 24 LTS and npm 11+ on `PATH` (verified: `node v24.14.0`, `npm 11.9.0`).
- The workspace package name **`@crm/api`** is a shared contract with the root scripts in `package.json` (`dev:api` runs `npm run start:dev --workspace @crm/api`). Do not rename it here.
- **No PostgreSQL required for this story.** Prisma and the database land in [Story 03](03-story-prisma-postgres-migration-1.md). The health endpoint built here reports process liveness only and Story 03 extends it.

---

## Story Goal

Stand up the NestJS backend so it boots, serves a documented health endpoint, validates all input, logs every request as structured JSON, and turns every thrown error into a consistent JSON envelope.

User-visible outcomes:

1. `npm run dev:api` starts the API on `http://localhost:3000`.
2. `GET /api/health` returns `200` with a JSON body describing service status and uptime.
3. `http://localhost:3000/api/docs` serves interactive Swagger UI listing the health endpoint.
4. Any unhandled error returns a predictable JSON envelope — never an HTML stack trace.
5. Every request emits one structured log line carrying a correlation id.

**Not in scope:** Prisma, any database access, migrations, seeding (all Story 03). Authentication, authorization, rate limiting, and any CRM domain endpoints — those are later work items, not this bootstrap.

---

## Context — Read These Files First

1. [Story 01 plan](01-story-workspace-scaffolding-1.md) — read **Product rules (from story)** for the fixed NestJS / PostgreSQL / npm decisions, and task 2 for the exact root `package.json` scripts this story must satisfy.
2. `apps/api/.env.example` — created by Story 01. Read all of it. This story consumes `NODE_ENV`, `PORT`, `CORS_ORIGINS`, and `LOG_LEVEL`. It must **not** consume `DATABASE_URL` yet, but the variable stays in the file for Story 03.
3. `package.json` (repo root) — read the `scripts` and `workspaces` keys. `dev:api` and the `--workspaces --if-present` fan-out scripts determine which script names `apps/api/package.json` must expose: **`start:dev`**, **`build`**, **`test`**, **`lint`**, **`typecheck`**.
4. `.prettierrc.json` and `.editorconfig` (repo root) — `singleQuote: true`, `printWidth: 100`, `indent_size = 2`, LF endings. The NestJS scaffolder writes its own `.prettierrc` inside `apps/api/`; task 2 below deletes it so the root config wins.
5. `.squad/stories/init-porject/1/intake.md` — the **Description** block lists the five backend concerns this story delivers: "Configure environment variables", "Configure API structure, validation, logging, Swagger/OpenAPI and global error handling", and "Create API health check".
6. After scaffolding, read the generated `apps/api/src/main.ts` and `apps/api/src/app.module.ts` end to end (each under 30 lines) before editing — you replace both.
7. After scaffolding, read `apps/api/tsconfig.json` and `apps/api/nest-cli.json` (both small) to confirm the compiler options and `sourceRoot` the scaffolder chose before task 3 adjusts them.

---

## Backend Tasks

### 1 — Scaffold the NestJS application

Run from the **repo root**:

```bash
npx @nestjs/cli@latest new api --directory apps/api --package-manager npm --skip-git --skip-install --strict
```

Flag rationale:

- `--directory apps/api` — writes into the empty directory Story 01 created.
- `--skip-git` — **required**. Without it the scaffolder initializes a nested git repo inside `apps/api/`.
- `--skip-install` — **required**. Installing inside the workspace creates a nested `apps/api/node_modules` and defeats npm workspace hoisting. Install from the root in task 2.
- `--strict` — enables TypeScript `strict` and `strictNullChecks` in the generated `tsconfig.json`. The whole feature is strict-mode.

If the scaffolder prompts for a package manager despite the flag, answer **npm**.

---

### 2 — Fix up the generated manifest

**File: `apps/api/package.json`**

The scaffolder writes `"name": "api"`. Change it and add the scripts the root fan-out expects:

- Set `"name": "@crm/api"` — **required** by the root `dev:api` script.
- Set `"private": true`.
- Keep the generated `build`, `start`, `start:dev`, `start:prod`, `lint`, `test`, `test:watch`, `test:cov`, and `test:e2e` scripts.
- **Add** a `typecheck` script: `"typecheck": "tsc --noEmit -p tsconfig.json"`. The root `npm run typecheck` depends on it.

Then delete the files that duplicate root-level config:

- Delete `apps/api/.prettierrc` — the root `.prettierrc.json` from Story 01 governs formatting for the whole monorepo. Two configs drift.
- Delete `apps/api/.gitignore` if the scaffolder wrote one — the root `.gitignore` already ignores `node_modules/`, `dist/`, and `coverage/`.
- **Keep** `apps/api/eslint.config.mjs`. NestJS 11 ships flat ESLint config and the linting rules are genuinely app-specific.

Delete the scaffolded demo files — they are replaced by the health module in task 6:

- `apps/api/src/app.controller.ts`
- `apps/api/src/app.controller.spec.ts`
- `apps/api/src/app.service.ts`
- `apps/api/test/app.e2e-spec.ts`

**Keep** `apps/api/test/jest-e2e.json` — task 9's e2e test reuses it.

Now install the runtime dependencies from the **repo root** so they hoist into the root `node_modules`:

```bash
npm install --workspace @crm/api @nestjs/config @nestjs/swagger class-validator class-transformer nestjs-pino pino-http
npm install --workspace @crm/api --save-dev pino-pretty
```

- `@nestjs/config` — loads and validates `.env`.
- `@nestjs/swagger` — OpenAPI document + Swagger UI.
- `class-validator` + `class-transformer` — required by both `ValidationPipe` and the env validation in task 4.
- `nestjs-pino` + `pino-http` — structured request logging.
- `pino-pretty` is **devDependency only**. Production must emit raw JSON lines for log shipping; pretty-printing there wastes CPU and breaks parsers.

Then run `npm install` at the root once more to refresh the root lockfile.

---

### 3 — Confirm TypeScript configuration

**File: `apps/api/tsconfig.json`**

Read the generated file. Ensure these are set — the `--strict` flag should have handled most:

```jsonc
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2023",
    "strict": true,
    "strictNullChecks": true,
    "declaration": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**`emitDecoratorMetadata` and `experimentalDecorators` must both be `true`.** NestJS dependency injection and `class-validator` both read the metadata the compiler emits; without them the app compiles but fails at runtime with unresolvable-dependency errors.

`forceConsistentCasingInFileNames: true` matters on this Windows working tree — it catches an `./health/HealthModule` import that resolves locally but breaks in Linux CI.

Do **not** change `"module": "commonjs"`. NestJS 11's decorator metadata and the `nest build` pipeline assume CommonJS; switching to ESM is a separate migration.

---

### 4 — Environment variable schema and validation

**Create file: `apps/api/src/config/env.validation.ts`**

Fail fast at boot on bad configuration rather than at first request.

```ts
import { plainToInstance, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  /** Comma-separated browser origins allowed by CORS. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}
```

Two details that matter:

- **`enableImplicitConversion: true`** is why `@IsInt()` works on `PORT`. Every value in `process.env` is a string; without implicit conversion `PORT` arrives as `"3000"` and `@IsInt()` rejects it.
- **`exposeDefaultValues: true`** is why the class field initializers act as defaults for absent variables.
- Do **not** validate `DATABASE_URL` here. Story 03 adds it. Adding it now makes the API refuse to boot before PostgreSQL exists, which blocks this story's own verification.
- `Transform` is imported for use by Story 03 when it adds `DATABASE_URL`; if the linter flags it as unused, drop the import and re-add it in Story 03.

---

### 5 — Global exception filter

**Create file: `apps/api/src/common/filters/all-exceptions.filter.ts`**

One JSON envelope for every failure, whatever throws it.

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

export interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ url?: string; id?: string }>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let error = HttpStatus[statusCode] ?? 'Error';

    if (isHttp) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else {
        const body = response as { message?: string | string[]; error?: string };
        message = body.message ?? exception.message;
        error = body.error ?? error;
      }
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      path: httpAdapter.getRequestUrl(request) ?? (request.url ?? 'unknown'),
      timestamp: new Date().toISOString(),
      requestId: request.id,
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, requestId: body.requestId, path: body.path },
        'Unhandled exception',
      );
    }

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }
}
```

Design notes for the executor:

- `@Catch()` with **no arguments** catches everything, including non-`Error` throws.
- It uses `HttpAdapterHost` rather than Express `Response` directly, so the filter keeps working if the platform is swapped to Fastify later.
- **Never** put `exception` details into the response body for `5xx`. The stack goes to the log; the client gets `"Internal server error"`. Leaking internals is how database schemas end up in bug reports.
- `4xx` responses keep NestJS's own message — that is what carries `ValidationPipe`'s field-level errors as a `string[]`.
- `requestId` is populated by the logger in task 7. It is the link between a user's error report and the server log line.

---

### 6 — Health module

**Create file: `apps/api/src/health/dto/health-response.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ example: 'customer-support-crm-api' })
  service!: string;

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({ example: 'development' })
  environment!: string;

  @ApiProperty({ example: 12.34, description: 'Process uptime in seconds.' })
  uptimeSeconds!: number;

  @ApiProperty({ example: '2026-08-25T07:10:11.113Z', format: 'date-time' })
  timestamp!: string;
}
```

`@ApiProperty` on every field is what makes Swagger show a real response schema instead of an empty object. The `!` definite-assignment assertions are required under `strictNullChecks` for DTO classes that are never constructed with `new`.

**Create file: `apps/api/src/health/health.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthResponseDto } from './dto/health-response.dto';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'customer-support-crm-api',
      version: process.env.npm_package_version ?? '0.1.0',
      environment: this.configService.get('NODE_ENV', { infer: true }),
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
    };
  }
}
```

**Story 03 extends this method** to probe PostgreSQL and downgrade `status` to `'error'`. Keep the return shape stable so the frontend in Story 04 does not need reworking.

`ConfigService<EnvironmentVariables, true>` — the `true` type argument marks the config as validated, so `get()` returns a non-nullable type and does not need a `!`.

**Create file: `apps/api/src/health/health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Service health check',
    description: 'Returns process liveness. Extended with a database probe in Story 03.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto {
    return this.healthService.check();
  }
}
```

**Create file: `apps/api/src/health/health.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

With the global prefix from task 8, the route resolves to **`GET /api/health`**.

---

### 7 — Root module: config and logging

**File: `apps/api/src/app.module.ts`**

Replace the scaffolded contents entirely.

```ts
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
        autoLogging: {
          ignore: (req) => req.url === '/api/health',
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'res.headers["set-cookie"]',
          ],
          censor: '[redacted]',
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
            : undefined,
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

Notes:

- `isGlobal: true` means no other module needs to import `ConfigModule` to inject `ConfigService`.
- `envFilePath: '.env'` resolves relative to the **process working directory**, which is `apps/api` when started via `npm run start:dev --workspace @crm/api`. Running `node dist/main` from the repo root will not find it — see **Edge Cases**.
- `LoggerModule.forRoot` reads `process.env` directly, not `ConfigService`. This is deliberate: the logger is constructed before the validated config is injectable. The env validation in task 4 still guards the value at boot.
- **`autoLogging.ignore` on `/api/health`** is important. Load balancers and Story 04's frontend poll this endpoint; without the filter it drowns every other log line. Errors on that route are still logged, because the filter only suppresses the automatic completion line.
- **`redact`** prevents `authorization` and `cookie` headers from reaching log storage. Add to this list whenever a new sensitive header appears — this is the only place it is enforced.
- `transport: pino-pretty` is gated on `development` because `pino-pretty` is a devDependency and will not resolve in a production install.

---

### 8 — Bootstrap: prefix, validation, CORS, Swagger, filter

**File: `apps/api/src/main.ts`**

Replace the scaffolded contents entirely.

```ts
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const port = configService.get('PORT', { infer: true });
  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const corsOrigins = (configService.get('CORS_ORIGINS', { infer: true }) ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

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

  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

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

  await app.listen(port);
}

void bootstrap();
```

Critical details:

- **`bufferLogs: true` plus `app.useLogger(app.get(Logger))`** is the required pair for `nestjs-pino`. Buffering holds startup log lines until the pino logger is attached; without it, boot messages bypass pino and arrive unstructured.
- **`whitelist: true` and `forbidNonWhitelisted: true`** together mean an unrecognized body property is a `400`, not a silent drop. Strict by default is the right posture for a new API — relax it per-DTO if a genuine passthrough case appears.
- **`setGlobalPrefix('api')` does not affect the Swagger path.** Passing `'api/docs'` to `SwaggerModule.setup` yields exactly `/api/docs`. Do not write `'docs'` expecting the prefix to apply — that serves at `/docs`.
- **`enableCors` is called only when `CORS_ORIGINS` is non-empty.** Calling `enableCors()` with an empty array would block everything. In development the Vite proxy from Story 04 makes CORS unnecessary anyway; this exists for deployed environments where the frontend is on another origin.
- **`app.enableShutdownHooks()`** wires `SIGTERM` to Nest's lifecycle hooks. Story 03 depends on it to disconnect Prisma cleanly.
- `await app.listen(port)` with no host argument binds all interfaces, which is what container health checks need.

---

## Edge Cases & Failure Modes

- **`.env` not found when running the compiled build.** Trigger: `node apps/api/dist/main` from the repo root. `envFilePath: '.env'` in `apps/api/src/app.module.ts` (task 7) resolves against the process CWD, so the file is missed and validation falls back to defaults. Expected: always start from `apps/api/`, or pass an absolute `envFilePath`. This is why `README.md` documents `npm run dev:api` rather than a raw `node` command.
- **Invalid `PORT`.** Trigger: `PORT=abc`. Expected: `validateEnv` throws `Invalid environment configuration: PORT must be an integer number` and the process exits non-zero **before** binding a socket. Enforced in `apps/api/src/config/env.validation.ts`, task 4.
- **`PORT` out of range.** Trigger: `PORT=99999`. Expected: rejected by `@Max(65535)`. Without that bound, Node throws an opaque `ERR_SOCKET_BAD_PORT` deep in the listen call.
- **Port already in use.** Trigger: another process on 3000. Expected: `EADDRINUSE` from `app.listen`, unhandled, non-zero exit. No retry logic — a silent port shift would make the frontend proxy point at nothing.
- **Unknown `LOG_LEVEL`.** Trigger: `LOG_LEVEL=verbose` (a NestJS level, not a pino level). Expected: `@IsEnum(LogLevel)` rejects it at boot. Note the mismatch: pino uses `trace`, NestJS uses `verbose`. The enum in task 4 is the pino set, deliberately.
- **Non-`Error` throw.** Trigger: `throw 'boom'` or a rejected promise with a string. Expected: `@Catch()` with no arguments still handles it, yielding a `500` with `"Internal server error"`. Enforced by `AllExceptionsFilter`, task 5. A filter narrowed to `@Catch(HttpException)` would let this escape as an HTML stack trace.
- **Validation error shape.** Trigger: `POST` with an unknown property to any future endpoint. Expected: `400` and `message` is a **`string[]`** of per-field messages, not a string. `ErrorResponseBody.message` in task 5 is typed `string | string[]` for exactly this. Story 04's error handling must tolerate both.
- **`5xx` leaking internals.** Trigger: a thrown error whose message contains a connection string. Expected: the response body says `"Internal server error"` and the detail appears only in the log. Enforced by the `isHttp` branch in task 5 — verify this with the test in Test Plan item 4.
- **Sensitive headers in logs.** Trigger: a request with an `Authorization` header. Expected: the log line shows `"authorization": "[redacted]"`. Enforced by `redact.paths` in task 7. Adding a new auth header without adding it here writes credentials to log storage.
- **Health endpoint floods the log.** Trigger: a 1-second poll from Story 04 or a load balancer. Expected: no automatic request log line for `/api/health`, other routes unaffected. Enforced by `autoLogging.ignore` in task 7.
- **`x-request-id` supplied by a client.** Trigger: a caller sends its own `x-request-id`. Expected: `genReqId` in task 7 **trusts and reuses it** so traces span services. This means the value is client-controlled and must never be used for authorization or interpolated into SQL — it is a log correlation id only.
- **Missing decorator metadata.** Trigger: `emitDecoratorMetadata` set to `false` in `apps/api/tsconfig.json`. Expected: the app compiles, then fails at boot with "Nest can't resolve dependencies". Guarded by task 3 — check this first if DI breaks.
- **Swagger reachable in production.** `SwaggerModule.setup` in task 8 is **not** environment-gated, so `/api/docs` is public in every environment. That is acceptable while there is no authentication and no real data, and it is what makes the demo possible. **Gate it before the first deployment that holds customer data** — flagged here as known and deliberate, not overlooked.
- **`pino-pretty` missing in production.** Trigger: `NODE_ENV=production` with a `--omit=dev` install. Expected: the `transport` option is `undefined`, so pino writes raw JSON and never tries to load the module. Enforced by the `NODE_ENV === 'development'` guard in task 7.

---

## Test Plan

Use the Jest setup the scaffolder produced. Unit specs sit next to their subject as `*.spec.ts`; e2e specs live in `apps/api/test/` and run through `apps/api/test/jest-e2e.json`.

1. **Unit — `apps/api/src/config/env.validation.spec.ts`** (new). Test `validateEnv`:
   - returns defaults `PORT === 3000`, `NODE_ENV === 'development'`, `LOG_LEVEL === 'info'` for an empty object;
   - coerces `{ PORT: '4000' }` to the **number** `4000` (asserts `enableImplicitConversion`);
   - throws on `{ PORT: 'abc' }`, on `{ PORT: '99999' }`, on `{ NODE_ENV: 'staging' }`, and on `{ LOG_LEVEL: 'verbose' }`;
   - accepts a missing `CORS_ORIGINS`.
2. **Unit — `apps/api/src/health/health.controller.spec.ts`** (new). Build a testing module with `Test.createTestingModule`, providing a stub `HealthService`. Assert `check()` returns `status: 'ok'` and that all six DTO fields are present. Model the file on the `app.controller.spec.ts` the scaffolder generated before task 2 deleted it.
3. **Unit — `apps/api/src/health/health.service.spec.ts`** (new). Provide a stub `ConfigService` whose `get` returns `'test'`. Assert `environment === 'test'`, `uptimeSeconds` is a finite number `>= 0`, and `timestamp` parses as a valid ISO date.
4. **Unit — `apps/api/src/common/filters/all-exceptions.filter.spec.ts`** (new). This is the highest-value test in the story. With a mocked `HttpAdapterHost` and `ArgumentsHost`, assert:
   - a `BadRequestException` with a `string[]` message yields `statusCode: 400` and preserves the array;
   - a plain `new Error('sensitive connection string')` yields `statusCode: 500` and a body message of exactly `'Internal server error'` — **assert the original message is absent from the serialized body**;
   - a bare `throw 'boom'` (non-`Error`) still yields `500`;
   - `requestId` is copied from `request.id` when present and omitted when not.
5. **Integration (e2e) — `apps/api/test/health.e2e-spec.ts`** (new, replaces the deleted `app.e2e-spec.ts`). Boot the full `AppModule` with `Test.createTestingModule`, then replicate the `setGlobalPrefix`, `useGlobalPipes`, and `useGlobalFilters` calls from task 8 on the test instance — `main.ts` does not run under Jest, so an e2e test that skips this hits `/health` instead of `/api/health` and sees no filter. Assert with `supertest`:
   - `GET /api/health` → `200`, `body.status === 'ok'`, `body.service === 'customer-support-crm-api'`;
   - `GET /health` → `404` (proves the global prefix is applied);
   - `GET /api/does-not-exist` → `404` with a body carrying `statusCode`, `message`, `error`, `path`, and `timestamp` (proves the filter formats framework-generated errors too).
6. **Integration (e2e) — same file.** Assert `GET /api/docs-json` returns `200` and that `body.paths['/api/health']` exists. This is the cheapest possible guard against the `'api/docs'` vs `'docs'` prefix mistake called out in task 8.
7. **Remove:** `apps/api/test/app.e2e-spec.ts` and `apps/api/src/app.controller.spec.ts`, deleted in task 2 along with the demo controller and service they cover.

---

## Verification Steps

1. **Backend installs:** from the repo root, run `npm install`. Expect exit code 0 and **no** `apps/api/node_modules` directory (dependencies hoist to the root).
2. **Backend type-checks:** from `apps/api`, run `npm run typecheck`. Expect exit code 0 and no output.
3. **Backend builds:** from `apps/api`, run `npm run build`. Expect `apps/api/dist/main.js` to exist.
4. **Backend lints:** from `apps/api`, run `npm run lint`. Expect exit code 0.
5. **Backend tests:** from `apps/api`, run `npm test` then `npm run test:e2e`. Expect both green.
6. **Backend runs:** from the repo root, run `npm run dev:api`. Expect a startup log line reporting the mapped `/api/health` route and a listener on port 3000.
7. **Health responds:** with the API running, `curl -i http://localhost:3000/api/health`. Expect `200` and a JSON body containing `"status":"ok"`, `"service":"customer-support-crm-api"`, `uptimeSeconds`, and `timestamp`.
8. **Global prefix holds:** `curl -i http://localhost:3000/health`. Expect `404` with the JSON envelope from the filter — **not** an HTML error page.
9. **Swagger serves:** open `http://localhost:3000/api/docs` in a browser. Expect Swagger UI with a **health** tag, one `GET /api/health` operation, and a populated response schema showing all six fields.
10. **Error envelope:** `curl -i http://localhost:3000/api/nope`. Expect `404` and a body with all of `statusCode`, `message`, `error`, `path`, `timestamp`.
11. **Logging works:** watch the `npm run dev:api` output while running step 10. Expect one structured, pretty-printed line carrying a `reqId`. Then run step 7 again and expect **no** new request line (health is filtered).
12. **Redaction works:** `curl -H "Authorization: Bearer secret123" http://localhost:3000/api/nope` and inspect the log line. Expect `[redacted]` and **no** occurrence of `secret123`.
13. **Boot-time validation:** temporarily set `PORT=abc` in `apps/api/.env` and run `npm run dev:api`. Expect a non-zero exit with `Invalid environment configuration` and **no** open socket. Restore `PORT=3000` afterwards.
14. **Regression:** from the repo root, run `npm run build` and `npm run typecheck`. Expect both to succeed and to skip `apps/web`, which is still empty.

---

## Done Criteria

- [ ] `apps/api/package.json` is named `@crm/api`, is `private`, and exposes `start:dev`, `build`, `test`, `test:e2e`, `lint`, and `typecheck`.
- [ ] `apps/api/.prettierrc` is deleted; the root `.prettierrc.json` governs formatting.
- [ ] The scaffolded `app.controller.ts`, `app.controller.spec.ts`, `app.service.ts`, and `test/app.e2e-spec.ts` are deleted.
- [ ] `npm install` at the root exits 0 and creates no `apps/api/node_modules`.
- [ ] `apps/api/tsconfig.json` has `strict`, `strictNullChecks`, `emitDecoratorMetadata`, `experimentalDecorators`, and `forceConsistentCasingInFileNames` all `true`.
- [ ] `apps/api/src/config/env.validation.ts` exports `EnvironmentVariables` and `validateEnv`, and rejects a non-numeric `PORT`, an out-of-range `PORT`, an unknown `NODE_ENV`, and an unknown `LOG_LEVEL` at boot.
- [ ] `validateEnv` does **not** require `DATABASE_URL` — the API boots with no database present.
- [ ] `apps/api/src/common/filters/all-exceptions.filter.ts` is registered globally, uses `@Catch()` with no arguments, returns the `statusCode` / `message` / `error` / `path` / `timestamp` / `requestId` envelope, and never puts `5xx` internals in the body.
- [ ] `GET /api/health` returns `200` with `status`, `service`, `version`, `environment`, `uptimeSeconds`, and `timestamp`.
- [ ] `GET /health` returns `404`, proving `setGlobalPrefix('api')` is active.
- [ ] `ValidationPipe` is global with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
- [ ] Swagger UI serves at `/api/docs` and the OpenAPI document at `/api/docs-json` lists `/api/health` with a full response schema.
- [ ] `nestjs-pino` is wired with `bufferLogs: true` plus `app.useLogger(app.get(Logger))`; request logs carry a `reqId`, `/api/health` is excluded from auto-logging, and `authorization` and `cookie` are redacted.
- [ ] `pino-pretty` is a **devDependency** and the transport is gated on `NODE_ENV === 'development'`.
- [ ] `app.enableShutdownHooks()` is called in `main.ts`.
- [ ] All tests in the Test Plan exist and pass; `npm run lint`, `npm run typecheck`, and `npm run build` are green in `apps/api`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 03.**
