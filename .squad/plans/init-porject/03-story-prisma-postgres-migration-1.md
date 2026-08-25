# Story 03 — Prisma, PostgreSQL `CustomerCRM`, initial migration and seed (Story: 1)

## Prerequisites

- [Story 01 completed](01-story-workspace-scaffolding-1.md): npm workspaces monorepo, `apps/api/.env.example` already declaring `DATABASE_URL`, and `.prettierignore` already excluding `apps/api/prisma/migrations`.
- [Story 02 completed](02-story-backend-api-bootstrap-1.md): NestJS app boots, `GET /api/health` returns `200`, `AllExceptionsFilter` is registered globally, `validateEnv` exists in `apps/api/src/config/env.validation.ts`, and `app.enableShutdownHooks()` is called in `apps/api/src/main.ts`. **`enableShutdownHooks` is load-bearing for this story** — it is what triggers `onModuleDestroy` so Prisma disconnects cleanly.
- **A running PostgreSQL 16+ server is required.** `psql` was **not** on `PATH` in the environment where this plan was written, so the executor must confirm a local server is reachable before starting. Neither the migration nor the verification steps can be completed without one.
- Per [ADR 0001](../../../docs/adr/0001-stack-decisions.md), created in Story 01: the engine is **PostgreSQL**, not SQL Server, despite the work item's `SQLServer` label.

---

## Story Goal

Connect the API to PostgreSQL through Prisma, create the `CustomerCRM` database with a real applied migration and an idempotent seed, and extend the health endpoint to actually prove the database round-trip.

User-visible outcomes:

1. `GET /api/health` reports a `database` block with `up`/`down` and a measured latency, returning `503` when PostgreSQL is unreachable.
2. `npx prisma migrate dev` produces a committed migration under `apps/api/prisma/migrations/`.
3. `npx prisma db seed` is safe to run repeatedly and never duplicates rows.
4. The API refuses to boot when `DATABASE_URL` is missing or malformed.

**Not in scope — and this is a deliberate decision, not an oversight:** no CRM domain models (customers, tickets, agents, comments, SLAs). This story creates the **migration and seed machinery** plus one infrastructure table so both are exercised end to end. Modelling the support domain is later work-item territory; guessing at it now would produce a migration that the first real domain story has to undo.

---

## Context — Read These Files First

1. [Story 02 plan](02-story-backend-api-bootstrap-1.md) — read **task 4** (`env.validation.ts`, which you extend here), **task 6** (`HealthService.check`, which you extend here — the plan already notes "Story 03 extends this method"), and **task 7** (`autoLogging.ignore` on `/api/health`).
2. `apps/api/src/config/env.validation.ts` — the whole file. Read the `EnvironmentVariables` class and the `validateEnv` function. Note the `Transform` import that Story 02 left in place for this story. `DATABASE_URL` is **deliberately absent** and you add it now.
3. `apps/api/src/health/health.service.ts` — the whole file (~20 lines). The `check()` method currently returns a synchronous object. You make it `async` and add a database probe.
4. `apps/api/src/health/dto/health-response.dto.ts` — the whole file. Every field carries `@ApiProperty`; match that style for the new nested DTO.
5. `apps/api/src/health/health.controller.ts` — the whole file (~22 lines). Note `@ApiOkResponse({ type: HealthResponseDto })` and the `@ApiTags('health')` grouping.
6. `apps/api/.env.example` — created by Story 01. The `DATABASE_URL` line and the comment above it already warn about the case-sensitive database name. Read that comment before task 1.
7. `apps/api/src/main.ts` — confirm `app.enableShutdownHooks()` is present (Story 02, task 8). Grep for `enableShutdownHooks` in `apps/api/src/`; if it is missing, add it before starting this story.
8. `.prettierignore` (repo root) — confirm `apps/api/prisma/migrations` is listed. Prisma stores a checksum per migration; reformatting the generated SQL invalidates it and Prisma then refuses to apply the migration.

---

## Backend Tasks

### 1 — Create the `CustomerCRM` database

**This is the single most error-prone step in the feature. Read it fully before typing.**

PostgreSQL folds unquoted identifiers to lower case. These two commands do **not** produce the same database:

```sql
CREATE DATABASE CustomerCRM;     -- creates a database named  customercrm
CREATE DATABASE "CustomerCRM";   -- creates a database named  CustomerCRM
```

The work item specifies the name `CustomerCRM`, and the `DATABASE_URL` in `apps/api/.env.example` spells it that way. The database name in a connection URL is sent verbatim as a protocol parameter and is matched **case-sensitively**, so an unquoted `CREATE DATABASE` yields `customercrm` and Prisma then fails with `database "CustomerCRM" does not exist`.

Create it with the quotes:

```bash
psql -U postgres -c 'CREATE DATABASE "CustomerCRM";'
```

Or, equivalently, with `createdb` — which passes the name as a literal string rather than as SQL, so no quoting is needed:

```bash
createdb -U postgres CustomerCRM
```

Verify the exact stored name before going further:

```bash
psql -U postgres -c '\l' | grep -i customercrm
```

Expect the listed name to read **`CustomerCRM`** with that exact capitalization. If it reads `customercrm`, drop it and recreate it with quotes — do not "fix" it by lowercasing `DATABASE_URL`, because the work item's acceptance criterion names the `CustomerCRM` database.

Then copy the env file if it does not exist yet and set the real credentials:

```bash
cp apps/api/.env.example apps/api/.env
```

---

### 2 — Install Prisma and initialize it

Run from the **repo root** so packages hoist into the root `node_modules`:

```bash
npm install --workspace @crm/api @prisma/client
npm install --workspace @crm/api --save-dev prisma
```

`prisma` (the CLI) is a **devDependency**; `@prisma/client` (the runtime) is a **dependency**. Getting this backwards either ships the CLI to production or breaks the runtime import.

Then, from **`apps/api`**:

```bash
npx prisma init --datasource-provider postgresql
```

This creates `apps/api/prisma/schema.prisma` and may append a `DATABASE_URL` line to `apps/api/.env`. **Check `apps/api/.env` afterwards** and remove any duplicate `DATABASE_URL` the CLI added — a second assignment silently wins over the first and will point at a `mydb` placeholder.

`prisma init` also writes `apps/api/.gitignore` containing `.env` in some versions. The root `.gitignore` from Story 01 already covers this; delete the nested file to keep ignore rules in one place.

---

### 3 — Define the schema

**File: `apps/api/prisma/schema.prisma`**

Replace the generated contents.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Key/value application settings. Deliberately infrastructure-only:
/// it exercises the migration and seed pipeline without committing to a
/// domain model. CRM domain entities arrive in a later work item.
model AppSetting {
  id        String   @id @default(uuid()) @db.Uuid
  key       String   @unique
  value     String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("app_settings")
}
```

Decisions the executor must not quietly change:

- **`@@map("app_settings")` and `@map("created_at")`** — the database uses `snake_case`, the TypeScript client uses `camelCase`. Choosing this now avoids a rename migration once real tables exist.
- **`@db.Uuid`** stores a native PostgreSQL `uuid` rather than a 36-byte `text`. Omitting it produces a `text` column that is slower to index and awkward to change later.
- **`@updatedAt`** is maintained by Prisma in the client, **not** by a database trigger. A raw `UPDATE` in `psql` will not touch it. That is expected; do not add a trigger in this story.
- Leave the `generator client` block without an explicit `output`. The default resolves through the hoisted root `node_modules`. See **Edge Cases** for the deprecation warning this may print.

---

### 4 — Create the initial migration

From **`apps/api`**:

```bash
npx prisma migrate dev --name init
```

This does four things: creates `apps/api/prisma/migrations/<timestamp>_init/migration.sql`, applies it, creates the `_prisma_migrations` bookkeeping table, and runs `prisma generate`.

**Commit the entire `apps/api/prisma/migrations/` directory**, including `migration_lock.toml`. The migration history is source code — a migration that exists only in one developer's database is the most common cause of "works on my machine" schema drift.

Open the generated `migration.sql` and confirm it creates `app_settings` with a `uuid` `id`, a unique index on `key`, and `created_at` / `updated_at` columns. Do **not** hand-edit it — Prisma stores a checksum and refuses to apply a modified migration.

---

### 5 — Seed structure

**Create file: `apps/api/prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const settings: { key: string; value: string }[] = [
  { key: 'app.name', value: 'Customer Support CRM' },
  { key: 'app.schemaVersion', value: '1' },
  { key: 'app.seededBy', value: 'prisma/seed.ts' },
];

async function main(): Promise<void> {
  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  const count = await prisma.appSetting.count();
  console.log(`Seed complete. app_settings rows: ${count}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
```

Why it is written this way:

- **`upsert` keyed on the unique `key` column makes the seed idempotent.** Running it twice must not duplicate rows and must not throw. A `create`-based seed fails on the second run with a unique-constraint violation, which then blocks every `prisma migrate reset`.
- **`process.exitCode = 1` rather than `process.exit(1)`** lets the `finally` block disconnect before the process ends. A hard `process.exit` leaves the connection dangling.
- The seed uses `console.log`, not the Nest logger — it runs as a standalone script outside the Nest DI container.

**File: `apps/api/package.json`**

Register the seed command and add convenience scripts:

```jsonc
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "prisma:seed": "prisma db seed",
    "prisma:reset": "prisma migrate reset"
  }
}
```

The `prisma.seed` key is a **top-level** field in `package.json`, a sibling of `scripts` — not a member of it. Placing it inside `scripts` makes `prisma db seed` report that no seed command is configured.

`ts-node` ships as a devDependency in the NestJS scaffold. Confirm it with `npm ls ts-node --workspace @crm/api`; install it as a devDependency if absent.

Add a `postinstall` script running `prisma generate` **only if** CI turns out to need it. Do not add it speculatively — it runs on every `npm install` at the root and fails when `DATABASE_URL` is unset.

---

### 6 — `PrismaService`

**Create file: `apps/api/src/prisma/prisma.service.ts`**

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

**Create file: `apps/api/src/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- `@Global()` means feature modules inject `PrismaService` without importing `PrismaModule`. Register it exactly once, in `AppModule`.
- `onModuleInit` calling `$connect()` makes a bad `DATABASE_URL` fail **at boot** rather than on the first query. Without it, Prisma connects lazily and the app appears healthy until traffic arrives.
- `onModuleDestroy` fires only because Story 02 called `app.enableShutdownHooks()`. Do **not** use the old `$on('beforeExit')` pattern — that hook is not emitted by the current Prisma library engine.

---

### 7 — Register `PrismaModule` and validate `DATABASE_URL`

**File: `apps/api/src/app.module.ts`**

Add `PrismaModule` to the `imports` array, after `LoggerModule.forRoot(...)` and before `HealthModule`:

```ts
import { PrismaModule } from './prisma/prisma.module';
// ...
    PrismaModule,
    HealthModule,
```

**File: `apps/api/src/config/env.validation.ts`**

Add `DATABASE_URL` to the `EnvironmentVariables` class. It is **required** from this story onward — the app must not boot without it.

```ts
import { IsNotEmpty, Matches } from 'class-validator';

// inside class EnvironmentVariables:
  @IsString()
  @IsNotEmpty()
  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must be a postgresql:// connection string',
  })
  DATABASE_URL!: string;
```

Add `IsNotEmpty` and `Matches` to the existing `class-validator` import. The `!` definite-assignment assertion is required under `strictNullChecks` because the field has no initializer — which is exactly the point: no default means no boot without it.

The `@Matches` guard catches the specific mistake this feature is exposed to. Given the work item's stale `SQLServer` label, someone will eventually paste an `sqlserver://` URL; this turns that into a clear boot-time message instead of an obscure Prisma error.

Update `apps/api/.env.example` if the `DATABASE_URL` line drifted from the Story 01 version — it must still point at `CustomerCRM`.

---

### 8 — Extend the health check with a database probe

**File: `apps/api/src/health/dto/health-response.dto.ts`**

Add a nested DTO and one field. Keep every existing field unchanged — Story 04's frontend renders them.

```ts
export class DatabaseHealthDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status!: 'up' | 'down';

  @ApiProperty({ example: 3.2, description: 'Round-trip time of a SELECT 1 probe, in ms.' })
  latencyMs!: number;

  @ApiProperty({
    required: false,
    example: 'connection refused',
    description: 'Present only when status is "down".',
  })
  message?: string;
}
```

Then add to `HealthResponseDto`:

```ts
  @ApiProperty({ type: () => DatabaseHealthDto })
  database!: DatabaseHealthDto;
```

`type: () => DatabaseHealthDto` — the **thunk form** is required. A bare class reference in a nested `@ApiProperty` produces an empty `{}` schema in Swagger for anything but the simplest cases.

**File: `apps/api/src/health/health.service.ts`**

Make `check()` async and probe the database.

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseHealthDto, HealthResponseDto } from './dto/health-response.dto';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {}

  async check(): Promise<HealthResponseDto> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'up' ? 'ok' : 'error',
      service: 'customer-support-crm-api',
      version: process.env.npm_package_version ?? '0.1.0',
      environment: this.configService.get('NODE_ENV', { infer: true }),
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
      database,
    };
  }

  private async checkDatabase(): Promise<DatabaseHealthDto> {
    const startedAt = process.hrtime.bigint();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: this.elapsedMs(startedAt) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error({ err: error }, 'Database health probe failed');
      return { status: 'down', latencyMs: this.elapsedMs(startedAt), message };
    }
  }

  private elapsedMs(startedAt: bigint): number {
    return Number((process.hrtime.bigint() - startedAt) / 1000n) / 1000;
  }
}
```

- **`$queryRaw\`SELECT 1\`` as a tagged template** is the safe form — it parameterizes. Never build a probe with `$queryRawUnsafe`.
- **`process.hrtime.bigint()`**, not `Date.now()`. A sub-millisecond local probe reads as `0 ms` with `Date.now()`, which makes the latency field useless.
- The probe **catches and reports** rather than throwing. A health endpoint that 500s tells an operator far less than one that returns a structured `down` with the driver's message.
- The `message` field carries the driver error and is exposed to any caller of `/api/health`. That is intentional for operability while the endpoint is unauthenticated and the data is non-sensitive — the same caveat as the ungated Swagger UI in Story 02. Both get locked down together before the first deployment with real data.

**File: `apps/api/src/health/health.controller.ts`**

The endpoint must return `503` when the database is down, so that uptime monitors and container orchestrators see a failure rather than a `200` whose body says `error`.

```ts
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Service health check',
    description: 'Reports process liveness and a PostgreSQL round-trip probe.',
  })
  @ApiOkResponse({ type: HealthResponseDto, description: 'All dependencies healthy.' })
  @ApiServiceUnavailableResponse({
    type: HealthResponseDto,
    description: 'The database probe failed.',
  })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const result = await this.healthService.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
```

**`@Res({ passthrough: true })` is mandatory here.** Injecting `@Res()` without `passthrough` hands full response control to the handler, and Nest then stops serializing the returned object — the request hangs until it times out. With `passthrough: true` the status code is overridden while Nest still serializes the return value normally.

---

## Edge Cases & Failure Modes

- **Database created without quotes.** Trigger: `CREATE DATABASE CustomerCRM;` in `psql`. PostgreSQL stores `customercrm`; the URL in `apps/api/.env` asks for `CustomerCRM`. Expected: Prisma fails with `database "CustomerCRM" does not exist`. Fix by recreating with `CREATE DATABASE "CustomerCRM";` — task 1. **This is the most likely failure in the entire feature.**
- **Duplicate `DATABASE_URL` in `.env`.** Trigger: `prisma init` appends its placeholder below the line copied from `.env.example`. Expected: the **last** assignment wins, so the app silently targets `mydb`. Enforced by the explicit check in task 2. Symptom: a clean boot followed by `database "mydb" does not exist`.
- **`sqlserver://` connection string.** Trigger: someone follows the work item's stale `SQLServer` label. Expected: `@Matches` in task 7 rejects it at boot with `DATABASE_URL must be a postgresql:// connection string`, rather than an opaque Prisma provider error.
- **Missing `DATABASE_URL` after this story.** Trigger: a developer who set up during Story 02 never re-copied `.env.example`. Expected: `validateEnv` throws at boot. This is a **deliberate behaviour change from Story 02**, where the app booted without a database. Call it out in the commit message.
- **Password with special characters.** Trigger: a PostgreSQL password containing `@`, `/`, `#`, or `:`. Expected: the URL mis-parses and the host resolves wrongly. The value must be **percent-encoded** (`@` → `%40`). `@Matches` in task 7 does **not** catch this — it only checks the scheme. Symptom: an authentication or unknown-host error with a URL that looks correct.
- **PostgreSQL not running.** Trigger: the service is stopped. Expected at boot: `onModuleInit`'s `$connect()` rejects and the app **fails to start** — this is intended fail-fast. Expected if it stops while the app runs: `GET /api/health` returns **`503`** with `database.status === 'down'` and the driver message. Enforced in task 6 and task 8.
- **Database dies mid-session, then returns.** Trigger: restart PostgreSQL while the API runs. Expected: Prisma's pool reconnects on a later query, so `/api/health` recovers to `200` without an API restart. No manual reconnect logic — do not add any.
- **`@Res()` without `passthrough`.** Trigger: dropping `{ passthrough: true }` in task 8. Expected: the request hangs and eventually times out, because Nest stops serializing the return value. If `/api/health` hangs after this story, check this first.
- **Health sub-routes are logged.** `autoLogging.ignore` in `apps/api/src/app.module.ts` (Story 02, task 7) compares `req.url === '/api/health'` **exactly**. This story adds no sub-route, so the filter still holds. If a later story adds `/api/health/ready`, widen the predicate to `req.url?.startsWith('/api/health')` or that route will flood the logs.
- **Seed run twice.** Trigger: `npx prisma db seed` twice in a row. Expected: no error, no duplicate rows, `app_settings` count stays at 3. Enforced by `upsert` in task 5. Verify this explicitly — a non-idempotent seed also breaks every future `prisma migrate reset`.
- **`prisma.seed` in the wrong place.** Trigger: the `seed` key placed inside `scripts` instead of at the top level of `apps/api/package.json`. Expected: `prisma db seed` reports that no seed command is configured. Enforced by the note in task 5.
- **Reformatted migration SQL.** Trigger: Prettier or an editor touches a file under `apps/api/prisma/migrations/`. Expected: Prisma reports a checksum mismatch and refuses to apply. Prevented by the `.prettierignore` entry from Story 01 — confirm it before running task 4.
- **Prisma client not generated.** Trigger: a fresh clone runs `npm install` then `npm run build` without `prisma generate`. Expected: TypeScript fails on `import { PrismaClient } from '@prisma/client'` with missing exports. Fix by running `npm run prisma:generate --workspace @crm/api`. This is why the README instructions in the Migration section below list generate before build.
- **Prisma `output` deprecation warning.** `prisma generate` may print a warning that a future major version will require an explicit `output` on the `generator client` block. Expected: a **warning**, not an error; generation succeeds through the hoisted root `node_modules`. If generation ever fails to resolve at runtime under workspace hoisting, set `output` explicitly and update `.prettierignore` and `.gitignore` to match the new path.
- **`updatedAt` not moving.** Trigger: a row updated via raw SQL in `psql`. Expected: `updated_at` is unchanged, because `@updatedAt` is enforced in the Prisma client, not by a trigger. Documented in task 3; do not "fix" it with a trigger in this story.
- **`migrate dev` against a production database.** Trigger: running `prisma:migrate` with a production `DATABASE_URL`. Expected: `migrate dev` can prompt to **reset and drop data**. Deployed environments must use `prisma:deploy` (`prisma migrate deploy`), which only applies pending migrations and never resets. Both scripts exist in task 5 — the naming is the guardrail.

---

## Test Plan

Continue with the Jest setup from Story 02: unit specs beside their subject, e2e specs in `apps/api/test/` via `apps/api/test/jest-e2e.json`.

1. **Unit — `apps/api/src/config/env.validation.spec.ts`** (modify the file created in Story 02). Every existing case must now supply a valid `DATABASE_URL`, since the field is required — **expect the existing tests to fail until updated; that is the intended breakage.** Add cases: throws when `DATABASE_URL` is absent; throws when it is `''`; throws when it is `sqlserver://localhost;Database=CustomerCRM`; accepts `postgresql://u:p@localhost:5432/CustomerCRM?schema=public`; accepts the `postgres://` short scheme.
2. **Unit — `apps/api/src/health/health.service.spec.ts`** (modify the file created in Story 02). Provide a stub `PrismaService` whose `$queryRaw` is a Jest mock. Assert:
   - resolved probe → `status: 'ok'`, `database.status: 'up'`, `database.latencyMs` is a finite number `>= 0`, and `database.message` is `undefined`;
   - rejected probe with `new Error('connection refused')` → `status: 'error'`, `database.status: 'down'`, `database.message === 'connection refused'`;
   - a rejection with a non-`Error` value → `database.message === 'Unknown database error'`;
   - `$queryRaw` is called exactly once per `check()`.
3. **Unit — `apps/api/src/health/health.controller.spec.ts`** (modify the file created in Story 02). Pass a fake response object with a `status` Jest mock. Assert `status` is called with `200` when the service reports `ok` and with `503` when it reports `error`, and that the handler still returns the full DTO in both cases.
4. **Unit — `apps/api/src/prisma/prisma.service.spec.ts`** (new). Spy on `$connect` and `$disconnect`. Assert `onModuleInit` calls `$connect` once and `onModuleDestroy` calls `$disconnect` once. Assert `onModuleInit` **rejects** when `$connect` rejects — the fail-fast behaviour from task 6 is the point of the test.
5. **Integration (e2e) — `apps/api/test/health.e2e-spec.ts`** (modify the file created in Story 02). This test needs a **live** `CustomerCRM` database. Keep the existing global-prefix and `404`-envelope assertions, and add: `GET /api/health` → `200`, `body.database.status === 'up'`, `typeof body.database.latencyMs === 'number'`. Also assert `body.database.message` is absent on the healthy path.
6. **Integration (e2e) — same file.** Assert the OpenAPI document at `GET /api/docs-json` exposes a non-empty `components.schemas.DatabaseHealthDto` with `status` and `latencyMs` properties. This is the guard against the `type: () => DatabaseHealthDto` thunk mistake from task 8.
7. **Integration — `apps/api/test/seed.e2e-spec.ts`** (new, requires a live database). Run the seed logic twice against the test database and assert `app_settings` holds exactly 3 rows both times, and that `app.name` equals `'Customer Support CRM'`. This is the idempotency guard. Import and call the seed's `main`-equivalent rather than shelling out, so failures produce a usable stack trace.
8. **Smoke — migration determinism.** From `apps/api`, run `npx prisma migrate reset --force` followed by `npx prisma migrate deploy`. Assert both succeed and the seed runs as part of `reset`. Not a Jest test — a documented manual check, because it drops the database.

---

## Migration / Rollback

**Forward, on a developer machine:**

```bash
psql -U postgres -c 'CREATE DATABASE "CustomerCRM";'
cp apps/api/.env.example apps/api/.env      # then set real credentials
npm install                                  # from repo root
npm run prisma:generate --workspace @crm/api
npm run prisma:migrate  --workspace @crm/api
npm run prisma:seed     --workspace @crm/api
```

**Forward, in a deployed environment:** use `npm run prisma:deploy --workspace @crm/api`. Never `prisma:migrate` — `migrate dev` may prompt to reset and drop data.

**Rollback.** Prisma has no `migrate down`. Because this is the **first** migration, rollback is simply dropping and recreating an empty database:

```bash
psql -U postgres -c 'DROP DATABASE "CustomerCRM";'
psql -U postgres -c 'CREATE DATABASE "CustomerCRM";'
```

Then `git revert` the commit and delete the generated client with `rm -rf node_modules/.prisma`.

For local iteration prefer `npx prisma migrate reset --force` from `apps/api` — it drops, re-applies every migration, and re-runs the seed in one step. Once a later story ships a second migration, rollback stops being a drop-and-recreate and needs a hand-written down-migration; note that in that story, not this one.

**What could go wrong in a half-applied state:**

- `migration.sql` partially applied because the connection dropped mid-run. The `_prisma_migrations` table records the migration as **failed** with a rolled-back marker, and the next `migrate dev` refuses to proceed until it is resolved with `prisma migrate resolve --rolled-back <name>` or the database is reset. On a first migration, reset is strictly simpler.
- Migration applied but the seed failed. The schema is correct and `app_settings` is empty or partial. Re-run `npm run prisma:seed --workspace @crm/api` — the `upsert` in task 5 makes this safe from any partial state.
- Migration applied against `customercrm` (lowercase) while `.env` points at `CustomerCRM`. Two databases now exist, one migrated and one empty, and the API talks to the empty one. Drop the lowercase database and re-run the migration.

---

## Verification Steps

1. **Database exists with exact casing:** run `psql -U postgres -c '\l' | grep CustomerCRM`. Expect a row whose name is exactly `CustomerCRM`.
2. **Backend installs:** from the repo root, run `npm install`. Expect exit code 0.
3. **Client generates:** from `apps/api`, run `npx prisma generate`. Expect success. A deprecation warning about a future required `output` field is acceptable.
4. **Migration applies:** from `apps/api`, run `npx prisma migrate dev --name init`. Expect a new directory under `apps/api/prisma/migrations/` and "Your database is now in sync with your schema".
5. **Schema is real:** run `psql -U postgres -d CustomerCRM -c '\d app_settings'`. Expect columns `id` (`uuid`), `key` (`text`, unique), `value`, `created_at`, `updated_at`. Then `psql -U postgres -d CustomerCRM -c '\dt'` and expect both `app_settings` and `_prisma_migrations`.
6. **Seed works and is idempotent:** from `apps/api`, run `npx prisma db seed` **twice**. Expect both runs to print `app_settings rows: 3` and exit 0.
7. **Backend type-checks:** from `apps/api`, run `npm run typecheck`. Expect exit code 0.
8. **Backend builds:** from `apps/api`, run `npm run build`. Expect exit code 0.
9. **Backend tests:** from `apps/api`, run `npm test` then `npm run test:e2e`. Expect both green with the database running.
10. **Backend runs:** from the repo root, run `npm run dev:api`. Expect a `Connected to PostgreSQL` log line from `PrismaService` during startup.
11. **Health proves the round-trip:** `curl -i http://localhost:3000/api/health`. Expect `200`, `"status":"ok"`, and a `database` object with `"status":"up"` and a numeric `latencyMs`.
12. **Health fails correctly:** stop the PostgreSQL service, then `curl -i http://localhost:3000/api/health`. Expect **`503`**, `"status":"error"`, `database.status === 'down'`, and a `message`. Restart PostgreSQL and re-run — expect `200` again **without** restarting the API.
13. **Boot-time validation:** comment out `DATABASE_URL` in `apps/api/.env` and run `npm run dev:api`. Expect a non-zero exit mentioning `DATABASE_URL`. Then set it to `sqlserver://localhost` and expect the `must be a postgresql:// connection string` message. Restore it afterwards.
14. **Swagger reflects the new shape:** open `http://localhost:3000/api/docs`, expand `GET /api/health`, and confirm the response schema shows the nested `database` object with `status`, `latencyMs`, and `message` — **not** an empty `{}`.
15. **Regression:** confirm every Story 02 check still passes — `GET /health` returns `404`, `GET /api/nope` returns the JSON error envelope, `/api/docs` loads, and `/api/health` still produces no request log line.
16. **Regression:** from the repo root, run `npm run build`, `npm run typecheck`, and `npm test`. Expect all green.

---

## Done Criteria

- [ ] A PostgreSQL database named exactly `CustomerCRM` (capital C, C, R, M) exists and `psql -c '\l'` confirms the casing.
- [ ] `@prisma/client` is a **dependency** and `prisma` is a **devDependency** of `@crm/api`.
- [ ] `apps/api/.env` contains exactly one `DATABASE_URL`, pointing at `CustomerCRM`.
- [ ] `apps/api/prisma/schema.prisma` declares `provider = "postgresql"` and the `AppSetting` model with `@@map("app_settings")`, `@db.Uuid`, and snake_case `@map` on the timestamp columns.
- [ ] `apps/api/prisma/migrations/<timestamp>_init/migration.sql` and `migration_lock.toml` are committed, unmodified by hand.
- [ ] `psql -d CustomerCRM -c '\dt'` lists `app_settings` and `_prisma_migrations`.
- [ ] `apps/api/prisma/seed.ts` uses `upsert`; `npx prisma db seed` run twice leaves exactly 3 rows and exits 0 both times.
- [ ] The `prisma.seed` key is a **top-level** field in `apps/api/package.json`, not inside `scripts`.
- [ ] `apps/api/package.json` exposes `prisma:generate`, `prisma:migrate`, `prisma:deploy`, `prisma:seed`, `prisma:studio`, and `prisma:reset`.
- [ ] `PrismaService` extends `PrismaClient`, calls `$connect()` in `onModuleInit` and `$disconnect()` in `onModuleDestroy`, and uses no `$on('beforeExit')`.
- [ ] `PrismaModule` is `@Global()` and registered once in `AppModule`.
- [ ] `validateEnv` requires `DATABASE_URL` and rejects an empty value and a non-`postgresql://` scheme at boot.
- [ ] `GET /api/health` returns `200` with `database.status === 'up'` and a numeric `latencyMs` when PostgreSQL is up.
- [ ] `GET /api/health` returns **`503`** with `database.status === 'down'` and a `message` when PostgreSQL is down, and recovers to `200` without an API restart.
- [ ] `HealthController.check` uses `@Res({ passthrough: true })` and the endpoint does not hang.
- [ ] `/api/docs-json` exposes a populated `DatabaseHealthDto` schema.
- [ ] The existing `HealthResponseDto` fields from Story 02 are unchanged, so Story 04 can rely on the shape.
- [ ] All tests in the Test Plan exist and pass; `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, and `npm run test:e2e` are green in `apps/api`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 04.**
