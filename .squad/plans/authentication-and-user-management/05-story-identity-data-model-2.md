# Story 05 — Identity data model: users, roles, permissions, departments, branches (Story: 2)

## Prerequisites

- [Story 03 completed](../init-porject/03-story-prisma-postgres-migration-1.md): Prisma 6 wired to PostgreSQL `CustomerCRM`, `apps/api/prisma/schema.prisma` holding the `AppSetting` model, the migration at `apps/api/prisma/migrations/20260825114240_first_migration/migration.sql`, the exported `main()` in `apps/api/prisma/seed.ts`, and the `prisma:*` scripts in `apps/api/package.json`.
- [Story 04 completed](../init-porject/04-story-frontend-vue-connectivity-1.md): the frontend exists and boots. This story does not touch it.
- **PostgreSQL 16+ must be running and reachable** on the `DATABASE_URL` in `apps/api/.env`. This story creates a migration; it cannot be completed offline.
- The existing e2e test `apps/api/test/seed.e2e-spec.ts` asserts **exactly 3** `app_settings` rows (lines 19–22 and 33–41). This story must not add `app_settings` rows.

---

## Story Goal

Ship the persistence layer that work item 2 depends on: users with hashed passwords, a role/permission catalogue seeded with the six roles the story names, departments and branches, and refresh-token storage — in **one** Prisma migration, so Stories 06–08 add code only.

Outcomes:

1. `apps/api/prisma/schema.prisma` declares `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Department`, `Branch`, and `RefreshToken`.
2. One new migration directory under `apps/api/prisma/migrations/` creates all eight tables.
3. `npm run prisma:seed --workspace @crm/api` is idempotent and creates the six roles with their permission grants, a default department, a default branch, and one bootstrap administrator.
4. A `PasswordService` hashes and verifies passwords with a memory-hard KDF and **no new native dependency**.
5. Passwords are never stored, logged, or returned in plaintext anywhere.

**Not in scope:** any HTTP endpoint, guard, JWT, or DTO — all Story 06/07. Any frontend change — Story 08. Customer/ticket domain tables — the `customer` role is seeded as a role only; there is no `Customer` entity yet, per the init-porject overview's "No CRM domain models" exclusion.

---

## Product rules (from story)

The intake names six roles and lists "Departments and branches" as a first-class concern but does not define permissions. These decisions are **fixed for the whole feature**; Stories 06–08 consume them verbatim.

| Topic | Intake says | **Decision** |
|---|---|---|
| Role set | six named roles | Seeded rows in `roles`, keyed by the slugs in task 4. **Not** a Prisma `enum` — an enum makes every future role a migration. |
| Roles per user | not stated | **Many-to-many** via `user_roles`. A supervisor who also reports needs two roles without a new role row. |
| Permission model | "Roles and permissions" | Flat `resource:action` permission strings granted to roles, never directly to users. Users get permissions **only** through roles. |
| Password storage | "handled securely" | **scrypt** from Node's built-in `node:crypto` (task 3). `argon2` and `bcrypt` both need `node-gyp`; this tree is developed on Windows with no guaranteed toolchain, and the init-porject overview already records "pnpm is not installed" as the class of environment constraint that governs here. |
| Departments / branches | listed as a concern | Two independent lookup tables, each **nullable** on `User`. A system administrator belongs to neither. |
| Customer role | listed as a main role | Seeded with **zero** permissions. It exists so Story 07's assignment API and Story 08's screen can round-trip it; a customer portal is a later work item. |

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — all 21 lines. Note the `generator`/`datasource` blocks (lines 1–8) and the exact conventions `AppSetting` establishes at lines 13–21: `@id @default(uuid()) @db.Uuid`, `@map("snake_case")` on every multi-word column, `createdAt`/`updatedAt` pairs, and `@@map` to a plural snake_case table. **Every model you add follows these conventions.**
2. `apps/api/prisma/seed.ts` — all 31 lines. The exported `main()` (line 15), the `upsert`-per-row idempotency pattern (lines 16–22), and the `.catch`/`.finally` tail (lines 25–31). You extend this file; **do not** restructure it, because `apps/api/test/seed.e2e-spec.ts` imports `main` by name.
3. `apps/api/test/seed.e2e-spec.ts` — all 42 lines. This is the contract your seed must not break: `main()` resolves, `app_settings` stays at 3 rows, and a second `main()` changes no counts.
4. `apps/api/src/prisma/prisma.service.ts` — all 16 lines. `PrismaService extends PrismaClient`, so every model you add is reachable as `prisma.<model>` with no extra provider.
5. `apps/api/src/config/env.validation.ts` — lines 29–52 for the `EnvironmentVariables` class, and lines 54–73 for `validateEnv`. Note `whitelist: false` on line 62: **unknown environment variables pass validation untouched**, which is why the seed-only bootstrap variables in task 5 do **not** need a field on this class.
6. `apps/api/.env.example` — all of it. Task 5 appends a `--- Bootstrap admin (seed only) ---` block. Keep the existing comment style.
7. `apps/api/package.json` — the `scripts` block, specifically `prisma:migrate`, `prisma:deploy`, `prisma:seed`, and `prisma:reset`, plus the `"prisma": { "seed": "ts-node prisma/seed.ts" }` key. Task 2 uses these; do not add new ones.
8. [Story 03 plan](../init-porject/03-story-prisma-postgres-migration-1.md) — read **`### 4 — Create the initial migration`** and **`## Migration / Rollback`**. This story follows the same migration procedure, but rollback is **no longer** a drop-and-recreate: see this story's own Migration / Rollback section.
9. Grep for `app_settings` across `apps/api/` to confirm the only consumers are the seed and its e2e test before you touch either.

---

## Backend Tasks

### 1 — Extend the Prisma schema

**File: `apps/api/prisma/schema.prisma`**

Append the models below **after** the existing `AppSetting` block. Leave lines 1–21 untouched.

```prisma
/// Organisational unit a staff user belongs to. Nullable on User: a system
/// administrator belongs to no department.
model Department {
  id        String   @id @default(uuid()) @db.Uuid
  key       String   @unique
  name      String
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users User[]

  @@map("departments")
}

/// Physical or logical location. Independent of Department by design: a branch
/// hosts staff from several departments.
model Branch {
  id        String   @id @default(uuid()) @db.Uuid
  key       String   @unique
  name      String
  city      String?
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users User[]

  @@map("branches")
}

/// An authenticatable account. `email` is stored lower-cased — normalise at
/// every write (see Edge Cases); PostgreSQL unique indexes are case-sensitive.
model User {
  id                  String    @id @default(uuid()) @db.Uuid
  email               String    @unique
  fullName            String    @map("full_name")
  passwordHash        String    @map("password_hash")
  isActive            Boolean   @default(true) @map("is_active")
  mustChangePassword  Boolean   @default(false) @map("must_change_password")
  failedLoginAttempts Int       @default(0) @map("failed_login_attempts")
  lockedUntil         DateTime? @map("locked_until")
  lastLoginAt         DateTime? @map("last_login_at")
  departmentId        String?   @map("department_id") @db.Uuid
  branchId            String?   @map("branch_id") @db.Uuid
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  department    Department?    @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  branch        Branch?        @relation(fields: [branchId], references: [id], onDelete: SetNull)
  roles         UserRole[]
  refreshTokens RefreshToken[]

  @@index([departmentId])
  @@index([branchId])
  @@index([isActive])
  @@map("users")
}

/// A named bundle of permissions. Seeded rows, not a Prisma enum — see
/// "Product rules" above.
model Role {
  id          String   @id @default(uuid()) @db.Uuid
  key         String   @unique
  name        String
  description String?
  isSystem    Boolean  @default(true) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  permissions RolePermission[]
  users       UserRole[]

  @@map("roles")
}

/// A single `resource:action` capability. Granted to roles only, never to users.
model Permission {
  id          String   @id @default(uuid()) @db.Uuid
  key         String   @unique
  description String
  createdAt   DateTime @default(now()) @map("created_at")

  roles RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       String @map("role_id") @db.Uuid
  permissionId String @map("permission_id") @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([permissionId])
  @@map("role_permissions")
}

model UserRole {
  userId     String   @map("user_id") @db.Uuid
  roleId     String   @map("role_id") @db.Uuid
  assignedAt DateTime @default(now()) @map("assigned_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@index([roleId])
  @@map("user_roles")
}

/// Opaque refresh tokens, stored as a SHA-256 digest. A leaked database dump
/// must not yield usable tokens. Story 06 owns the rotation logic.
model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")
  userAgent String?   @map("user_agent")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

Constraints that are **not** negotiable:

- **`onDelete: SetNull`** on `User.department` and `User.branch`. `Cascade` there would delete staff accounts when a department is retired.
- **`onDelete: Cascade`** on all four join-table relations and on `RefreshToken.user`. Deleting a user must not leave orphaned grants or live sessions.
- `RolePermission` and `UserRole` use a **composite `@@id`**, not a surrogate `id`. The composite key *is* the uniqueness rule; a surrogate would allow duplicate grants.
- `email` is `@unique` but **not** case-insensitive at the database level. `citext` needs a PostgreSQL extension; normalising in application code is the decision. See Edge Cases.

---

### 2 — Create the migration

Run from `apps/api`:

```bash
npm run prisma:generate
npx prisma migrate dev --name identity_and_rbac
```

Expected result: a new `apps/api/prisma/migrations/<timestamp>_identity_and_rbac/migration.sql` containing eight `CREATE TABLE` statements, the unique indexes on `users.email`, `roles.key`, `permissions.key`, `departments.key`, `branches.key`, `refresh_tokens.token_hash`, and the `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` blocks.

**Read the generated `migration.sql` before committing it.** Confirm:

- No `DROP TABLE "app_settings"`. If Prisma proposes dropping or altering `app_settings`, the local database has drifted from the committed migration — stop, run `npx prisma migrate status`, and reconcile. **Do not** accept a data-loss prompt.
- `ON DELETE SET NULL` appears on the two `users` foreign keys, `ON DELETE CASCADE` on the join tables and `refresh_tokens`.

`prisma migrate dev` runs the seed automatically after applying. It will fail at this point because task 4 has not been written yet — that is expected; the migration is still recorded as applied. Re-run `npm run prisma:seed` after task 4.

---

### 3 — Password hashing service

**Create file: `apps/api/src/auth/password.service.ts`**

Create the `apps/api/src/auth/` directory here; Story 06 fills it out.

```ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

/**
 * scrypt work factors. N=2^15 with r=8 costs ~33 MB of memory per hash, which
 * is above Node's 32 MB default `maxmem` — hence the explicit 64 MB below.
 * Omitting it makes every hash throw "Invalid scrypt params".
 */
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ALGORITHM = 'scrypt';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

@Injectable()
export class PasswordService {
  /**
   * Returns a self-describing digest: `scrypt$N$r$p$saltB64$hashB64`.
   * The parameters travel with the hash so raising the work factor later does
   * not invalidate existing passwords.
   */
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await scryptAsync(plain.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);

    return [
      ALGORITHM,
      PARAMS.N,
      PARAMS.r,
      PARAMS.p,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  /** Constant-time verification. Returns false for any malformed digest. */
  async verify(plain: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');

    if (parts.length !== 6 || parts[0] !== ALGORITHM) {
      return false;
    }

    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');

    if (salt.length === 0 || expected.length === 0) {
      return false;
    }

    const derived = await scryptAsync(plain.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
```

**Critical details:**

- **`maxmem: 64 * 1024 * 1024` is mandatory.** With `N=32768, r=8` scrypt needs `128 * N * r` ≈ 33.5 MB; Node's default cap is 32 MB and every call would throw.
- `verify` must **return `false`**, never throw, on a malformed digest. A thrown error from `verify` becomes a `500` in Story 06's login path and leaks that the account exists.
- `timingSafeEqual` throws when the buffers differ in length, so the `derived.length === expected.length` check comes **first** — `&&` short-circuits.
- `.normalize('NFKC')` on both paths, or a password typed with a decomposed accent fails to verify on a different keyboard.
- **Do not** log `plain`, `stored`, or any derived buffer. This class has no logger on purpose.

---

### 4 — Seed the permission catalogue, roles, org units, and bootstrap admin

**File: `apps/api/prisma/seed.ts`**

Extend the existing file. Keep the `settings` array and its loop exactly as they are — `seed.e2e-spec.ts` depends on the 3-row outcome.

Add above `main()`:

```ts
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Duplicated from src/auth/password.service.ts on purpose: prisma/seed.ts runs
 * through ts-node outside the Nest DI container, and importing an @Injectable()
 * would drag reflect-metadata and the module graph into the seed.
 * The digest format MUST stay byte-compatible with PasswordService.verify.
 */
async function hashPassword(plain: string): Promise<string> {
  const params = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const salt = randomBytes(16);
  const derived = await scryptAsync(plain.normalize('NFKC'), salt, 64, params);

  return [
    'scrypt',
    params.N,
    params.r,
    params.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

const permissions: { key: string; description: string }[] = [
  { key: 'users:read', description: 'View user accounts' },
  { key: 'users:write', description: 'Create and update user accounts' },
  { key: 'users:deactivate', description: 'Deactivate and reactivate user accounts' },
  { key: 'roles:read', description: 'View roles and their permissions' },
  { key: 'roles:assign', description: 'Assign and remove roles on a user' },
  { key: 'departments:read', description: 'View departments' },
  { key: 'departments:write', description: 'Create and update departments' },
  { key: 'branches:read', description: 'View branches' },
  { key: 'branches:write', description: 'Create and update branches' },
  { key: 'reports:read', description: 'View reports and dashboards' },
];

const roles: { key: string; name: string; description: string; permissions: string[] }[] = [
  {
    key: 'system-administrator',
    name: 'System Administrator',
    description: 'Full control over users, roles, and organisation structure.',
    permissions: permissions.map((permission) => permission.key),
  },
  {
    key: 'crm-manager',
    name: 'CRM Manager',
    description: 'Manages staff accounts, role assignments, and organisation structure.',
    permissions: [
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
    ],
  },
  {
    key: 'support-supervisor',
    name: 'Support Supervisor',
    description: 'Reads staff records and reports; cannot change accounts.',
    permissions: ['users:read', 'roles:read', 'departments:read', 'branches:read', 'reports:read'],
  },
  {
    key: 'support-agent',
    name: 'Support Agent',
    description: 'Front-line agent. Sees organisation structure only.',
    permissions: ['departments:read', 'branches:read'],
  },
  {
    key: 'customer',
    name: 'Customer',
    description: 'External account. No administrative permissions.',
    permissions: [],
  },
  {
    key: 'reporting-user',
    name: 'Reporting User',
    description: 'Read-only analytics access.',
    permissions: ['reports:read', 'departments:read', 'branches:read'],
  },
];

const departments: { key: string; name: string }[] = [
  { key: 'customer-support', name: 'Customer Support' },
  { key: 'operations', name: 'Operations' },
];

const branches: { key: string; name: string; city: string }[] = [
  { key: 'head-office', name: 'Head Office', city: 'Cairo' },
];
```

Then, **inside** `main()` and **after** the existing `app_settings` loop, add the identity seeding. Order matters — permissions before roles, roles before grants, org units before the admin:

```ts
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const department of departments) {
    await prisma.department.upsert({
      where: { key: department.key },
      update: { name: department.name },
      create: department,
    });
  }

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { key: branch.key },
      update: { name: branch.name, city: branch.city },
      create: branch,
    });
  }

  for (const role of roles) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: { key: role.key, name: role.name, description: role.description },
    });

    const granted = await prisma.permission.findMany({
      where: { key: { in: role.permissions } },
      select: { id: true },
    });

    // Replace the grant set so removing a permission from this file actually
    // revokes it. Doing the delete and the re-insert in one transaction keeps
    // the role from being briefly permission-less under a concurrent request.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: record.id } }),
      prisma.rolePermission.createMany({
        data: granted.map((permission) => ({ roleId: record.id, permissionId: permission.id })),
      }),
    ]);
  }

  await seedBootstrapAdmin();
```

Add the bootstrap admin as a module-level helper below `main()`:

```ts
async function seedBootstrapAdmin(): Promise<void> {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@crm.local').trim().toLowerCase();
  const fromEnv = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const generated = fromEnv ? null : randomBytes(18).toString('base64url');
  const password = fromEnv ?? generated!;

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Never overwrite a password an administrator may already have rotated.
    // Re-running the seed must not reset live credentials.
    console.log(`Bootstrap admin ${email} already exists; password left unchanged.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        fullName: 'System Administrator',
        passwordHash: await hashPassword(password),
        mustChangePassword: !fromEnv,
      },
    });

    if (generated) {
      console.log(`Bootstrap admin created: ${email}`);
      console.log(`Generated password (shown once): ${generated}`);
    } else {
      console.log(`Bootstrap admin created: ${email} (password from BOOTSTRAP_ADMIN_PASSWORD)`);
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'system-administrator' } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  // Idempotent on the composite primary key.
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
}
```

**Do not** print the password when it came from `BOOTSTRAP_ADMIN_PASSWORD` — that copies a configured secret into CI logs. The generated one is printed because it exists nowhere else.

The composite-key `where` argument is named **`userId_roleId`** — Prisma derives it from the `@@id([userId, roleId])` field order. Reversing the field order in the schema renames it and breaks this call.

Extend the closing log in `main()` so the seed reports what it did (replacing the current `count()` + `console.log` pair at lines 24–25):

```ts
  const [settingCount, permissionCount, roleCount, userCount] = await Promise.all([
    prisma.appSetting.count(),
    prisma.permission.count(),
    prisma.role.count(),
    prisma.user.count(),
  ]);

  console.log(
    `Seed complete. app_settings: ${settingCount}, permissions: ${permissionCount}, ` +
      `roles: ${roleCount}, users: ${userCount}`,
  );
```

---

### 5 — Environment documentation

**File: `apps/api/.env.example`**

Append, matching the existing `# --- Section ---` comment style:

```dotenv
# --- Bootstrap admin (seed only) ---
# Consumed by prisma/seed.ts, NOT by the API at runtime, which is why these are
# absent from EnvironmentVariables in src/config/env.validation.ts.
# Leave BOOTSTRAP_ADMIN_PASSWORD unset outside development: the seed then
# generates a random password and prints it once.
BOOTSTRAP_ADMIN_EMAIL=admin@crm.local
BOOTSTRAP_ADMIN_PASSWORD=ChangeMe_Dev_Only_1
```

**Do not** add fields for these to `EnvironmentVariables` in `apps/api/src/config/env.validation.ts`. `validateEnv` passes unknown keys through (`whitelist: false`, line 62), and putting bootstrap credentials into the API's typed config invites a runtime consumer.

Add the same two lines to `apps/api/.env` locally so `npm run prisma:seed` is deterministic. `.env` is gitignored.

---

### 6 — Register `PasswordService`

**Create file: `apps/api/src/auth/auth.module.ts`**

A minimal module now; Story 06 adds the controller, guards, and JWT wiring.

```ts
import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';

@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class AuthModule {}
```

**File: `apps/api/src/app.module.ts`**

Add `AuthModule` to the `imports` array (currently `PrismaModule, HealthModule` at lines 46–47) and its import statement alongside the existing module imports at lines 6–7. Place it **after** `PrismaModule` so the `@Global()` Prisma provider is registered first.

---

## Edge Cases & Failure Modes

- **Mixed-case email registration.** `Ahmed@X.com` and `ahmed@x.com` are two rows under PostgreSQL's case-sensitive unique index. **Every** write path must `.trim().toLowerCase()` the address; the seed does it in `seedBootstrapAdmin` (task 4) and Story 07's create/update DTOs must do the same. Enforced only in application code — there is no database-level guard.
- **Unicode in `fullName`.** `full_name` is `TEXT`, so Arabic, accents, and emoji all store correctly. No length cap in the schema; Story 07's DTO imposes one.
- **Password longer than 64 characters or containing NUL.** scrypt has no length limit (unlike bcrypt's 72-byte truncation) and Node hashes the full UTF-8 buffer, so nothing is silently dropped. A literal `\0` is hashed as-is and round-trips.
- **`maxmem` default.** Dropping `maxmem` from `PARAMS` in `password.service.ts` makes **every** hash and verify throw `Invalid scrypt params` — a 500 on every login. Covered by Test Plan item 2.
- **Malformed `password_hash` in the database** (hand-edited row, truncated column, digest from another algorithm): `PasswordService.verify` returns `false`. It must never throw; Test Plan item 3 covers `''`, `'garbage'`, `'scrypt$1$2$3'`, and a bcrypt-shaped `$2b$…` string.
- **Seed re-run after an administrator rotates the bootstrap password.** `seedBootstrapAdmin` finds the existing row and leaves `passwordHash` alone. The role grant is still re-upserted, so a removed admin role is restored — deliberate, so the deployment cannot lock itself out.
- **Seed run against a database where `identity_and_rbac` has not been applied.** Prisma throws `P2021` / `The table 'public.permissions' does not exist`. Run `npm run prisma:deploy --workspace @crm/api` first. This is the most likely failure when someone pulls this branch and runs `prisma:seed` alone.
- **Removing a permission from the `permissions` array in `seed.ts`.** The row stays in the `permissions` table — the seed never deletes permissions. Only role→permission grants are replaced. Deleting a permission row is a manual, deliberate act because `RolePermission` cascades from it.
- **Concurrent seed runs.** Two `prisma db seed` processes racing on the same `upsert` yield a `P2002` unique-constraint error in one of them. The seed is a single-operator command; no locking is added.
- **Deleting a department that has users.** `onDelete: SetNull` clears `users.department_id` and keeps the accounts. Story 07 exposes deactivation rather than deletion for departments, so this path is reachable only through `psql`.
- **Refresh tokens for a deleted user.** `onDelete: Cascade` removes them with the user, so a deleted account cannot refresh its way back in.

---

## Test Plan

1. **Unit — `apps/api/src/auth/password.service.spec.ts`** (new). Follow the `Test.createTestingModule` shape in `apps/api/src/health/health.service.spec.ts` lines 12–29, but `PasswordService` has no dependencies so `providers: [PasswordService]` is enough.
   - `hash` returns a `scrypt$…` digest with exactly 6 `$`-separated segments.
   - Two `hash` calls on the same input return **different** digests (random salt).
   - `verify` returns `true` for a matching password.
   - `verify` returns `false` for a wrong password.
   - `verify` returns `true` for a 200-character password and for `'كلمة السر ١٢٣'` — no truncation, unicode round-trip.
   - `verify` returns `true` when the same password is supplied in NFD vs NFC form (the `normalize('NFKC')` guarantee).
2. **Unit — same file.** `hash` on a 12-character password resolves without throwing. This is the regression test for `maxmem`; with the option removed it fails with `Invalid scrypt params`.
3. **Unit — same file.** `verify` returns `false`, and does **not** reject, for each of `''`, `'garbage'`, `'scrypt$1$2$3'`, `'$2b$12$abcdefghijklmnopqrstuv'`, and a digest whose base64 hash segment has been truncated by one character.
4. **E2E — `apps/api/test/seed.e2e-spec.ts`** (modify). Keep all four existing tests unchanged, then add, in the same `prisma.<model>.count()` style used at lines 19–22:
   - `permissions` has 10 rows.
   - `roles` has 6 rows and their `key` values match the six slugs exactly.
   - `system-administrator` has 10 grants; `customer` has 0; `support-agent` has 2.
   - `departments` has 2 rows and `branches` has 1.
   - The bootstrap admin exists, is `isActive`, and holds `system-administrator` (query `userRole` with `include: { role: true }`).
   - Running `main()` twice leaves every count above unchanged **and** leaves the admin's `passwordHash` byte-identical — capture it before, compare after.
5. **E2E — same file.** After a second `main()`, `refresh_tokens` is still empty; the seed must not mint sessions.
6. **No test for the migration SQL itself.** It is verified by Verification Step 3 (`prisma migrate status`) and by test 4 running against a migrated database.

---

## Migration / Rollback

**Forward, on a developer machine** (from `apps/api`):

```bash
npm run prisma:generate
npx prisma migrate dev --name identity_and_rbac
npm run prisma:seed
```

**Forward, in a deployed environment:**

```bash
npm run prisma:deploy --workspace @crm/api
npm run prisma:seed   --workspace @crm/api
```

Never `prisma:migrate` there — `migrate dev` may offer to reset and drop data.

**Rollback.** This is the **second** migration, so Story 03's drop-and-recreate no longer applies without losing `app_settings`. Two options:

- *Local iteration:* `npx prisma migrate reset --force` from `apps/api`. Drops everything, replays both migrations, re-runs the seed. Acceptable because no story has yet put real data in this database.
- *A database you must preserve:* hand-write the down SQL, dropping in reverse dependency order, then delete the migration directory and its `_prisma_migrations` row.

```sql
DROP TABLE IF EXISTS "refresh_tokens";
DROP TABLE IF EXISTS "user_roles";
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "roles";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "branches";
DROP TABLE IF EXISTS "departments";
DELETE FROM "_prisma_migrations" WHERE "migration_name" LIKE '%identity_and_rbac';
```

`app_settings` is untouched in both directions.

**What could go wrong in a half-applied state:**

- **Migration interrupted mid-run.** `_prisma_migrations` marks it failed and the next `migrate dev` refuses to proceed. Confirm with `\dt` in `psql` which tables actually exist, resolve with `npx prisma migrate resolve --rolled-back <migration_name>`, then re-run.
- **Migration applied, seed failed halfway** (say after permissions but before roles). Every seed write is an `upsert`, or a delete-then-create inside one transaction, so re-running `npm run prisma:seed` converges. The one non-idempotent-looking step, the bootstrap admin, is guarded by a `findUnique` first.
- **Seed ran before the migration.** No tables, immediate `P2021`, nothing written. Apply the migration and re-run.
- **Generated Prisma client stale after a schema edit.** Symptom: `prisma.user` is `undefined` at runtime, or TypeScript cannot find the `User` type. Fix with `npm run prisma:generate --workspace @crm/api`. On Windows this fails with `EPERM` while a `nest start --watch` process holds `node_modules/.prisma` — stop the API first.

---

## Verification Steps

1. **Schema is valid:** from `apps/api`, run `npx prisma validate`. Expect "The schema at prisma/schema.prisma is valid".
2. **Client generates:** from `apps/api`, run `npm run prisma:generate`. Expect exit code 0. Stop any running `npm run dev:api` first — see Migration / Rollback.
3. **Migration applies cleanly:** from `apps/api`, run `npx prisma migrate status`. Expect "Database schema is up to date!" and **two** migrations listed. Then in `psql`, `\dt` on `CustomerCRM` must list exactly ten tables: `_prisma_migrations`, `app_settings`, `branches`, `departments`, `permissions`, `refresh_tokens`, `role_permissions`, `roles`, `user_roles`, `users`.
4. **Foreign key actions are correct:** in `psql`, run `\d users`. Expect the `department_id` and `branch_id` foreign keys with `ON DELETE SET NULL`. Then `\d user_roles` — expect both foreign keys with `ON DELETE CASCADE`.
5. **Seed runs and reports:** from `apps/api`, run `npm run prisma:seed`. Expect the summary line `app_settings: 3, permissions: 10, roles: 6, users: 1` and a "Bootstrap admin created" line.
6. **Seed is idempotent:** run `npm run prisma:seed` again. Expect the identical summary line and "already exists; password left unchanged."
7. **Password never stored in plaintext:** in `psql`, `SELECT email, password_hash FROM users;`. Expect the hash to begin `scrypt$32768$8$1$` and to contain none of the plaintext.
8. **Backend type-checks:** from `apps/api`, run `npm run typecheck`. Expect exit code 0.
9. **Backend lints:** from `apps/api`, run `npm run lint`. Expect exit code 0. `recommendedTypeChecked` is on, so an untyped `promisify` result fails here — that is why `scryptAsync` carries an explicit cast.
10. **Backend unit tests:** from `apps/api`, run `npm test`. Expect all specs green, including the new `password.service.spec.ts`.
11. **Backend e2e tests:** from `apps/api`, run `npm run test:e2e`. Expect `seed.e2e-spec.ts` and `health.e2e-spec.ts` both green.
12. **Regression:** from the repo root, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.
13. **Regression:** with `npm run dev:api` running, `GET http://localhost:3000/api/health` still returns `200` with `database.status: "up"`, and `http://localhost:3000/api/docs` still loads. This story adds no guard, so nothing about health changes.

---

## Done Criteria

- [ ] `apps/api/prisma/schema.prisma` declares `Department`, `Branch`, `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, and `RefreshToken`, all following the `@db.Uuid` / `@map` / `@@map` conventions of the existing `AppSetting` model.
- [ ] `AppSetting` (schema lines 13–21) is unmodified.
- [ ] `User.department` and `User.branch` use `onDelete: SetNull`; all join relations and `RefreshToken.user` use `onDelete: Cascade`.
- [ ] `RolePermission` and `UserRole` use composite `@@id`, with **no** surrogate `id` column.
- [ ] Exactly one new migration directory exists, its `migration.sql` creates eight tables, and it contains no statement touching `app_settings`.
- [ ] `npx prisma migrate status` reports the schema up to date with two migrations.
- [ ] `apps/api/src/auth/password.service.ts` exports `PasswordService` with `hash` and `verify`, uses `node:crypto` scrypt, sets `maxmem` to 64 MB, compares with `timingSafeEqual` after a length check, normalises with NFKC, and adds **no** new dependency to `apps/api/package.json`.
- [ ] `PasswordService.verify` returns `false` — never throws — for every malformed digest in Test Plan item 3.
- [ ] `apps/api/src/auth/auth.module.ts` provides and exports `PasswordService`, and `AppModule` imports it after `PrismaModule`.
- [ ] `apps/api/prisma/seed.ts` still exports `main`, still writes exactly 3 `app_settings` rows, and additionally seeds 10 permissions, the 6 named roles with the exact grants in task 4, 2 departments, 1 branch, and 1 bootstrap admin holding `system-administrator`.
- [ ] Re-running the seed changes no counts and leaves the admin's `password_hash` byte-identical.
- [ ] The seed prints a generated password only when `BOOTSTRAP_ADMIN_PASSWORD` is unset, and never prints a configured one.
- [ ] Email addresses are lower-cased on write in the seed.
- [ ] `apps/api/.env.example` documents `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` as seed-only, and neither appears in `EnvironmentVariables`.
- [ ] All tests in the Test Plan exist and pass; from the repo root `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green.
- [ ] `GET /api/health` and `/api/docs` behave exactly as before.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 06.**
