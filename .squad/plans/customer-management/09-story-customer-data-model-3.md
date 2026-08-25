# Story 09 — Customer data model: customers, notes, attachments, interactions (Story: 3)

## Prerequisites

- [Story 05 completed](../authentication-and-user-management/05-story-identity-data-model-2.md): the `User`, `Role`, `Permission`, `RolePermission`, and `UserRole` tables, and the seeded ten-permission catalogue this story extends.
- [Story 07 completed](../authentication-and-user-management/07-story-rbac-user-management-api-2.md): `@RequirePermissions()` and `PermissionsGuard`. This story adds the permission **keys** those decorators will name in Stories 10 and 11; it adds no decorator of its own.
- [Story 08 completed](../authentication-and-user-management/08-story-frontend-auth-user-management-2.md): the frontend consumes nothing here yet, but the tree must be on a green build before a migration lands.
- **PostgreSQL must be running** against the `CustomerCRM` database named in `apps/api/.env`. `prisma migrate dev` fails without it.
- The seeded administrator's password must be known — Story 10 onward logs in during e2e runs.

---

## Story Goal

Create the persistence layer for the whole customer-management work item in **one migration**, and extend the seeded permission catalogue so the endpoints of Stories 10 and 11 have keys to require.

Outcomes:

1. Four new tables — `customers`, `customer_notes`, `customer_attachments`, `customer_interactions` — plus four PostgreSQL enum types.
2. Six new permission keys seeded and granted to the existing roles, so a support agent can manage customers on the day Story 10 ships.
3. `npm run prisma:generate` produces `Prisma.CustomerSelect`, `CustomerStatus`, and the rest of the generated types every later story compiles against.
4. Re-running `npm run prisma:seed` stays idempotent: existing permission rows are updated, never duplicated, and no customer rows are invented.

**Not in scope:** every controller, service, and DTO — Stories 10 and 11. Any frontend file — Story 12. The `UPLOAD_DIR` environment variable and the filesystem layout for attachment **bytes** — Story 11 owns those; this story stores only the metadata row. A `Ticket` entity — see the overview's scope exclusions.

**This is the only story in the feature that creates a migration.** If Story 10, 11, or 12 needs a column, the fix is to revise this story and re-run `prisma migrate dev`, not to stack a second migration on top.

---

## Product rules (from story)

The intake asks for "customer database model", "customer status", "customer notes", "customer attachments", and "customer interaction and ticket history" without fixing the shapes. These are the decisions.

| Topic | **Decision** | Why |
|---|---|---|
| Status representation | A **Prisma enum** `CustomerStatus`, not a seeded lookup table | Unlike roles — Story 05 made those rows so a new role needs no migration — the status set is closed and drives branching in the service and badges in the UI. An enum gets a database-level check constraint and a generated TypeScript union for free. |
| Deletion | **No** `DELETE /api/customers`, ever. `ARCHIVED` is the terminal status | Mirrors Story 07's "users are deactivated, never deleted". A deleted customer cascades away its notes, attachments, and interaction history — exactly the history this work item exists to preserve. |
| Individual vs company | One `customers` table with a `type` discriminator and a nullable `companyName` | Two tables would double every query, DTO, and screen for two rows that differ by one field. |
| Contact information | Flat columns on `customers` (email, phone, alternate phone, address, city, country, postal code) | A `customer_contacts` child table — several named contact persons per company — is a real need for a B2B CRM and a real cost here. **Deliberately excluded**; recorded in the overview. |
| Email uniqueness | `@unique` on a **nullable** `email` | PostgreSQL treats `NULL`s as distinct, so any number of customers may have no email while a supplied address stays unique. Normalise to lower case at every write, exactly as Story 05 required for `users.email`. |
| Note ownership | Every note carries an `authorId`, restricted (`onDelete: Restrict`) | A note whose author vanished is an unattributable claim about a customer. Users are deactivated rather than deleted (Story 07), so `Restrict` never fires in practice — it guards against a future hard delete. |
| Attachment bytes | The database stores **metadata only**; the bytes live on the filesystem under a key this schema records | `bytea` for 10 MB documents bloats every backup and every `pg_dump`. Story 11 owns the storage service. |
| Interaction vs ticket | `customer_interactions` records a **logged touchpoint** (call, email, chat, meeting) | The work item names both "interaction" and "ticket history", but **no `Ticket` model exists anywhere in this repository** — verified against `apps/api/prisma/schema.prisma`. Interactions ship now; tickets join the same profile screen when their own work item lands. |
| Assignment | `customers.assigned_agent_id` → `users.id`, nullable, `onDelete: SetNull` | "As a support agent … handling requests" implies ownership. Nullable because unassigned is a normal state, and `SetNull` so deactivating an agent is never blocked by a customer row. |
| Demo data | The seed creates **no** customer rows | `prisma/seed.ts` runs against every environment including production. Fixtures belong in the e2e specs, which create and clean up their own. |

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — the whole file, 152 lines. In particular the `User` model at **lines 56–80** (this story appends five relation fields to it), the `Department`/`Branch` pair at **lines 25–52** (the `@map`/`@@map` snake-case convention every new model follows), `UserRole` at **lines 123–134** (composite-key join style), and `RefreshToken` at **lines 138–152** (`onDelete: Cascade` plus explicit `@@index`).
2. `apps/api/prisma/seed.ts` — **lines 41–52**, the `permissions` array this story extends; **lines 54–102**, the six roles and their grant lists; **lines 187–208**, the delete-then-recreate transaction that makes grants idempotent. Read all three before editing: appending a key to `permissions` without adding it to a role's list produces a permission nobody holds.
3. `apps/api/prisma/migrations/20260825130849_identity_and_rbac/migration.sql` — skim it. It is generated output; you will **not** hand-write the new one, but knowing what `prisma migrate dev` emits (`-- CreateTable`, `-- CreateIndex`, `-- AddForeignKey`, in that order) is how you review the diff.
4. `apps/api/src/users/users.service.ts` **lines 29–42** — the `USER_SELECT` constant with `satisfies Prisma.UserSelect`. Stories 10 and 11 build `CUSTOMER_SELECT` the same way, which only works if the models here are named exactly as specified.
5. `apps/api/package.json` — the `prisma` block (`"seed": "ts-node prisma/seed.ts"`) and the `prisma:*` scripts. Use `npm run prisma:migrate`, not a bare `npx prisma`, so the workspace's own Prisma version runs.
6. [Story 05's plan](../authentication-and-user-management/05-story-identity-data-model-2.md) — the precedent for a migration-plus-seed story in this repository. Match its rhythm: schema, migrate, seed, verify.

---

## Implementation tasks

### 1 — Enums

**File: `apps/api/prisma/schema.prisma`**

Add these **above** the `AppSetting` model, directly under the `datasource db` block. Prisma imposes no ordering; grouping the enums at the top keeps the models readable.

```prisma
/// Lifecycle of a customer relationship. A closed set that drives service
/// branching and UI badges, so it is an enum rather than a seeded lookup row —
/// unlike Role, which an administrator edits at runtime.
enum CustomerStatus {
  PROSPECT
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum CustomerType {
  INDIVIDUAL
  COMPANY
}

enum InteractionChannel {
  PHONE
  EMAIL
  CHAT
  MEETING
  OTHER
}

enum InteractionDirection {
  INBOUND
  OUTBOUND
}
```

`ARCHIVED` is the **terminal** status and the replacement for deletion. Nothing in this repository may issue a `customer.delete`.

### 2 — The `Customer` model

**File: `apps/api/prisma/schema.prisma`** — append after the `RefreshToken` model.

```prisma
/// A person or organisation the support desk serves. Never deleted: the
/// terminal state is `status: ARCHIVED`, so notes, attachments, and interaction
/// history survive. `email` is stored lower-cased — normalise at every write.
model Customer {
  id              String         @id @default(uuid()) @db.Uuid
  type            CustomerType   @default(INDIVIDUAL)
  name            String
  companyName     String?        @map("company_name")
  email           String?        @unique
  phone           String?
  alternatePhone  String?        @map("alternate_phone")
  addressLine1    String?        @map("address_line1")
  addressLine2    String?        @map("address_line2")
  city            String?
  country         String?
  postalCode      String?        @map("postal_code")
  status          CustomerStatus @default(PROSPECT)
  assignedAgentId String?        @map("assigned_agent_id") @db.Uuid
  createdById     String?        @map("created_by_id") @db.Uuid
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  assignedAgent User? @relation("CustomerAssignedAgent", fields: [assignedAgentId], references: [id], onDelete: SetNull)
  createdBy     User? @relation("CustomerCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  notes        CustomerNote[]
  attachments  CustomerAttachment[]
  interactions CustomerInteraction[]

  @@index([status])
  @@index([assignedAgentId])
  @@index([name])
  @@map("customers")
}
```

Three points the executor must not "simplify" away:

- **`@unique` on a nullable column is intentional.** PostgreSQL permits unlimited `NULL`s under a unique index, so "no email" is never a conflict while a supplied address stays unique.
- **Both `User` relations are named.** Two relations between the same pair of models force explicit `@relation("…")` names on **both** sides; omitting them is a `prisma validate` error, not a silent default.
- **`@@index([name])`** serves the list ordering (`orderBy: { name: 'asc' }`) Story 10 uses. It does **not** accelerate the `contains` search — see Edge Cases.

### 3 — Notes, attachments, interactions

**File: `apps/api/prisma/schema.prisma`** — append after `Customer`.

```prisma
/// Free-text note against a customer. Append-only by convention: only the
/// author may edit or delete their own note (enforced in Story 11's service).
model CustomerNote {
  id         String   @id @default(uuid()) @db.Uuid
  customerId String   @map("customer_id") @db.Uuid
  authorId   String   @map("author_id") @db.Uuid
  body       String
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  author   User     @relation("CustomerNoteAuthor", fields: [authorId], references: [id], onDelete: Restrict)

  @@index([customerId, createdAt])
  @@map("customer_notes")
}

/// Metadata for a file stored on disk. `storageKey` is a path this application
/// GENERATED (uuid + a mime-derived extension) — never the client's filename,
/// which is kept in `fileName` for display only. Story 11 owns the bytes.
model CustomerAttachment {
  id             String   @id @default(uuid()) @db.Uuid
  customerId     String   @map("customer_id") @db.Uuid
  uploadedById   String   @map("uploaded_by_id") @db.Uuid
  fileName       String   @map("file_name")
  storageKey     String   @unique @map("storage_key")
  mimeType       String   @map("mime_type")
  sizeBytes      Int      @map("size_bytes")
  checksumSha256 String   @map("checksum_sha256")
  createdAt      DateTime @default(now()) @map("created_at")

  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  uploadedBy User     @relation("CustomerAttachmentUploader", fields: [uploadedById], references: [id], onDelete: Restrict)

  @@index([customerId, createdAt])
  @@map("customer_attachments")
}

/// A logged touchpoint with a customer. `occurredAt` is when it HAPPENED, which
/// the agent supplies; `createdAt` is when it was recorded. They differ whenever
/// a call is logged after the fact, and the timeline sorts on the former.
model CustomerInteraction {
  id          String               @id @default(uuid()) @db.Uuid
  customerId  String               @map("customer_id") @db.Uuid
  createdById String               @map("created_by_id") @db.Uuid
  channel     InteractionChannel
  direction   InteractionDirection
  subject     String
  body        String?
  occurredAt  DateTime             @map("occurred_at")
  createdAt   DateTime             @default(now()) @map("created_at")

  customer  Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdBy User     @relation("CustomerInteractionAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([customerId, occurredAt])
  @@map("customer_interactions")
}
```

`onDelete: Cascade` from `Customer` is reachable only if somebody adds the delete this plan forbids. It exists so a manual `psql` cleanup cannot leave orphans — **not** as an invitation.

### 4 — Back-relations on `User`

**File: `apps/api/prisma/schema.prisma`** — the `User` model, currently **lines 56–80**.

Add five fields to the relation block that today reads `department` / `branch` / `roles` / `refreshTokens` (**lines 71–74**):

```prisma
  assignedCustomers    Customer[]            @relation("CustomerAssignedAgent")
  createdCustomers     Customer[]            @relation("CustomerCreatedBy")
  customerNotes        CustomerNote[]        @relation("CustomerNoteAuthor")
  customerAttachments  CustomerAttachment[]  @relation("CustomerAttachmentUploader")
  customerInteractions CustomerInteraction[] @relation("CustomerInteractionAuthor")
```

**Every foreign key lives on the child table.** These five fields add **no column to `users`** — confirm that in the generated SQL (Verification Step 3). If the migration wants to `ALTER TABLE "users" ADD COLUMN`, a relation was declared backwards.

The relation names must match the strings used in tasks 2 and 3 **character for character**.

### 5 — Generate the migration

From `apps/api`:

```bash
npm run prisma:migrate -- --name customers_notes_attachments_interactions
```

Then **read `apps/api/prisma/migrations/<timestamp>_customers_notes_attachments_interactions/migration.sql` before committing.** Expect, in this order:

- `CREATE TYPE "CustomerStatus" AS ENUM (…)` and three more `CREATE TYPE`.
- Four `-- CreateTable` blocks with snake_case columns.
- `CREATE UNIQUE INDEX "customers_email_key"` and `"customer_attachments_storage_key_key"`.
- The `@@index` entries as `CREATE INDEX`.
- `-- AddForeignKey` for all eight foreign keys: `ON DELETE SET NULL` for the two on `customers`, `ON DELETE RESTRICT` for the three author columns, `ON DELETE CASCADE` for the three `customer_id` columns.

**Do not hand-edit the generated SQL.** If it is wrong, fix `schema.prisma` and re-run; Prisma records a checksum and a later `migrate deploy` refuses a file edited after the fact.

Run `npm run prisma:generate` afterwards if the migrate command did not (it normally does).

### 6 — Seed the six new permissions

**File: `apps/api/prisma/seed.ts`**

Append to the `permissions` array (**lines 41–52**), after `reports:read`:

```ts
  { key: 'customers:read', description: 'View customers, their notes, attachments, and interactions' },
  { key: 'customers:write', description: 'Create and update customers' },
  { key: 'customers:archive', description: 'Archive and restore customers' },
  { key: 'notes:write', description: 'Add, edit, and delete customer notes' },
  { key: 'attachments:write', description: 'Upload and delete customer attachments' },
  { key: 'interactions:write', description: 'Log customer interactions' },
```

The catalogue goes from ten keys to **sixteen**. These six strings are the complete vocabulary Stories 10 and 11 may name in `@RequirePermissions()`; a key absent from this list is an endpoint nobody can ever call.

Then extend the `roles` array (**lines 54–102**). `system-administrator` needs **no edit** — line 59 already reads `permissions.map((permission) => permission.key)`, so it picks up all six automatically. For the rest:

| Role | Add | Rationale |
|---|---|---|
| `crm-manager` | all six | Manages the customer base end to end, archiving included. |
| `support-supervisor` | `customers:read`, `customers:write`, `notes:write`, `attachments:write`, `interactions:write` | Works customer records but does not retire them. **No `customers:archive`.** |
| `support-agent` | `customers:read`, `customers:write`, `notes:write`, `attachments:write`, `interactions:write` | This work item's protagonist. Story 07 left the agent with only `departments:read` and `branches:read`; that is what changes here. |
| `customer` | nothing | Stays permission-less. The portal is a later work item. |
| `reporting-user` | `customers:read` | Read-only analytics over the customer base. |

Leave `main()` (**lines 154–223**) untouched — its `for (const permission of permissions)` upsert loop and the grant-replacement transaction at **lines 202–207** already make this idempotent, and removing a key from a role's list actually revokes it.

**Do not** add customer rows to the seed.

---

## Edge Cases & Failure Modes

- **A duplicate customer email.** `POST` with an address another customer holds hits `customers_email_key` and Prisma throws `P2002`. Story 10 maps it to `409` in its own `mapPrismaError`, mirroring `apps/api/src/users/users.service.ts` **lines 362–368**. Nothing to do here beyond declaring the index.
- **Two customers with no email.** Both persist. That is the point of the nullable unique index, and it gets an e2e test below.
- **Mixed-case email.** `Nour@Example.com` and `nour@example.com` are **different rows** as far as PostgreSQL is concerned — the index is case-sensitive, exactly as Story 05 warned for `users.email`. The defence is normalisation in the service (Story 10), not the schema.
- **Unicode in `name`.** Arabic, accents, and emoji store and sort correctly; `name` is `TEXT` with no database-level length cap. Length limits are DTO-level in Story 10 (160 characters) — a UI concern, not an integrity one.
- **`prisma migrate dev` prompts to reset.** It does this when the local database has drifted from the migration history. **Read the prompt.** A reset destroys the seeded administrator and every user Story 07's tests created. Recover with `npm run prisma:seed`, and know the bootstrap password is regenerated unless `BOOTSTRAP_ADMIN_PASSWORD` is set in `apps/api/.env` (it is, in the committed `.env.example`).
- **The migration runs against a database with no `users` table.** Impossible in a correct history — Story 05's migration precedes this one — but if it happens, the three `RESTRICT` foreign keys fail loudly rather than silently creating unconstrained columns. That is the desired failure.
- **Partially applied migration.** All four `CREATE TABLE` statements and all eight foreign keys run inside one transaction, and PostgreSQL DDL is transactional, so a failure rolls the whole file back. There is no half-applied state to repair — fix the cause and re-run.
- **Search performance.** `@@index([name])` is a B-tree and does **not** serve the `contains` + `mode: 'insensitive'` search Story 10 performs; that is a sequential scan. Acceptable at this scale and **explicitly deferred**: a `pg_trgm` GIN index is the fix when the customer count justifies it, and it needs its own migration.
- **Attachment rows without files, files without rows.** The two stores can diverge — a crash between `writeFile` and `INSERT`, or a restored database pointed at an empty upload directory. Story 11 owns the ordering that minimises it (bytes first, row second, so the worst case is an orphaned file rather than a broken download). No schema affordance exists for reconciliation; a sweeper is out of scope.
- **Enum values travel as strings.** They serialise as the literals `'ACTIVE'`, `'COMPANY'`, and so on. Renaming an enum member later is a breaking API change requiring a data migration — pick these names once.

---

## Test Plan

1. **No new unit test.** This story adds no TypeScript with behaviour: the schema is declarative and the seed's logic is unchanged. Asserting that a Prisma model exists only re-states what the compiler already checks.
2. **Integration — `apps/api/test/seed.e2e-spec.ts`** (extend; keep every existing assertion and match the file's current structure).
   - `permission.count()` is **16**, and `permission.findMany` contains all six new keys.
   - The `system-administrator` role holds **all 16** keys.
   - The `support-agent` role holds `customers:read`, `customers:write`, `notes:write`, `attachments:write`, and `interactions:write`, and does **not** hold `customers:archive`.
   - The `support-supervisor` role does **not** hold `customers:archive`.
   - The `customer` role still holds **zero** permissions.
   - Running the seed again leaves `customer.count()` unchanged — the proof that the seed invents no customer rows.
3. **Integration — new file `apps/api/test/customers-schema.e2e-spec.ts`.** Talk to `PrismaClient` directly, no HTTP; this is a schema-shape test and must exist before the API does. Clean up in `afterAll` with `prisma.customer.deleteMany({ where: { name: { startsWith: 'E2E ' } } })`, the same fixture-suffix discipline `apps/api/test/users.e2e-spec.ts` uses at **lines 104–108**.
   - Creating a customer with only `name` succeeds and defaults to `status: 'PROSPECT'`, `type: 'INDIVIDUAL'`.
   - **Two** customers with `email: null` both persist — the nullable-unique proof.
   - Two customers with the same non-null email: the second rejects with `P2002`.
   - A note, an attachment row, and an interaction attach to a customer and come back through `include`.
   - Deleting a throw-away customer cascades all three children to zero — with a comment recording that the application itself never deletes.
   - Creating a note whose `authorId` is not a user rejects with `P2003`.
   - `interaction.findMany({ orderBy: { occurredAt: 'desc' } })` returns the later `occurredAt` first even when its `createdAt` is earlier — proving the two timestamps are genuinely independent.

---

## Migration / Rollback

**Forward:** `npm run prisma:migrate -- --name customers_notes_attachments_interactions` from `apps/api`, then `npm run prisma:seed`.

**Rollback.** Prisma has no `migrate down`. To undo before the work item ships:

1. Delete the migration directory `apps/api/prisma/migrations/<timestamp>_customers_notes_attachments_interactions/`.
2. Revert the `schema.prisma` and `seed.ts` edits.
3. In `psql`: `DROP TABLE customer_interactions, customer_attachments, customer_notes, customers CASCADE;` then `DROP TYPE "InteractionDirection", "InteractionChannel", "CustomerType", "CustomerStatus";` — **in that order**, children before parents, types last.
4. `DELETE FROM permissions WHERE key IN ('customers:read','customers:write','customers:archive','notes:write','attachments:write','interactions:write');` — the `role_permissions` grants cascade away with them.
5. `DELETE FROM _prisma_migrations WHERE migration_name LIKE '%customers_notes_attachments_interactions';`
6. `npm run prisma:generate` to regenerate the client without the new models.

**What a half-applied state looks like.** Because the DDL is transactional, the realistic split failure is "migration applied, seed not run": the tables exist, the six permission rows do not, and every Story 10 endpoint returns `403` for every caller including the administrator. The symptom is unmistakable and the fix is `npm run prisma:seed`.

---

## Verification Steps

1. **Schema is valid:** from `apps/api`, run `npx prisma validate`. Expect "The schema at prisma/schema.prisma is valid." A missing or mismatched `@relation` name fails here first.
2. **Migration applies:** from `apps/api`, `npm run prisma:migrate -- --name customers_notes_attachments_interactions`. Expect a new directory under `prisma/migrations/` and "Your database is now in sync with your schema."
3. **The `users` table is unchanged — check this before anything else.** Open the generated `migration.sql` and grep it for `ALTER TABLE "users"`. Expect **zero** matches. Five relation fields were added to the `User` model and none of them may touch its table.
4. **Client regenerates:** `npm run prisma:generate`, then from `apps/api` run `npm run typecheck`. Expect exit code 0 — no existing file references the new models yet, so a failure means something unrelated broke.
5. **Seed is idempotent:** run `npm run prisma:seed` **twice**. Both runs succeed, the second prints the same counts as the first, and the final line reports `permissions: 16`.
6. **Grants landed:** in `psql` against `CustomerCRM`:
   ```sql
   SELECT r.key, count(*) FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     JOIN permissions p ON p.id = rp.permission_id
    WHERE p.key LIKE 'customers:%' OR p.key IN ('notes:write','attachments:write','interactions:write')
    GROUP BY r.key ORDER BY r.key;
   ```
   Expect `crm-manager` 6, `reporting-user` 1, `support-agent` 5, `support-supervisor` 5, `system-administrator` 6, and **no row** for `customer`.
7. **Enum types exist:** `\dT+ "CustomerStatus"` in `psql` lists `PROSPECT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`.
8. **Tests:** from `apps/api`, `npm test` (unit, unchanged) and `npm run test:e2e`. Expect green, including the extended seed spec and the new `customers-schema.e2e-spec.ts`.
9. **Regression:** from the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.
10. **Regression:** start the API (`npm run dev:api`) and confirm it boots, `GET /api/health` reports the database up, and signing in still works. This story changed no runtime code — a boot failure means the generated client is stale, so re-run `npm run prisma:generate`.

---

## Done Criteria

- [ ] `apps/api/prisma/schema.prisma` declares `CustomerStatus`, `CustomerType`, `InteractionChannel`, and `InteractionDirection`.
- [ ] `Customer`, `CustomerNote`, `CustomerAttachment`, and `CustomerInteraction` exist with the exact field names, `@map` names, and `@@map` table names given above.
- [ ] `customers.email` is **nullable and unique**; `customer_attachments.storage_key` is unique.
- [ ] The `User` model gained five relation fields, all with explicit `@relation` names matching the child side, and the generated migration contains **no** `ALTER TABLE "users"`.
- [ ] `onDelete` is `SetNull` on both `customers` foreign keys to `users`, `Cascade` from `Customer` to its three children, and `Restrict` on `author_id`, `uploaded_by_id`, and `created_by_id`.
- [ ] Exactly **one** new migration directory exists, its SQL is untouched generated output, and `npx prisma migrate status` reports no pending migrations.
- [ ] `prisma/seed.ts` lists 16 permissions; `system-administrator` picks up all of them through the existing `permissions.map(...)`; `support-agent` and `support-supervisor` hold five customer keys **without** `customers:archive`; `reporting-user` holds `customers:read`; `customer` holds none.
- [ ] The seed creates **no** customer rows, and running it twice changes no counts.
- [ ] `apps/api/test/seed.e2e-spec.ts` asserts the 16-key catalogue and the per-role grants; `apps/api/test/customers-schema.e2e-spec.ts` covers the nullable-unique email, the duplicate-email rejection, the cascade, and the independence of `occurredAt` from `createdAt`.
- [ ] No controller, service, DTO, or frontend file was created or modified.
- [ ] From the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 10.**
