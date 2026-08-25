# Story 13 — Ticket data model: tickets, comments, attachments, history (Story: 4)

## Prerequisites

- [Story 12 completed](../customer-management/12-story-frontend-customer-management-3.md): work item 3 (customer-management) is fully shipped. A ticket always links to an existing `Customer` row, and the `customers`, `users`, `roles`, `permissions` tables this story's foreign keys and seed additions depend on must already exist.
- Coordinate with anyone editing `apps/api/prisma/schema.prisma` or `apps/api/prisma/seed.ts` concurrently — this story is, like [Story 09](../customer-management/09-story-customer-data-model-3.md), the only story in its feature that creates a migration.

## Story Goal

1. Add three new Prisma enums (`TicketCategory`, `TicketPriority`, `TicketStatus`) and four new models (`Ticket`, `TicketComment`, `TicketAttachment`, `TicketHistory`) to `apps/api/prisma/schema.prisma`.
2. Generate and apply one migration that creates these types/tables and their foreign keys.
3. Seed five new permission keys and grant them to the appropriate roles in `apps/api/prisma/seed.ts`.
4. Leave the API and frontend untouched — this story is schema and seed data only, exactly as [Story 09](../customer-management/09-story-customer-data-model-3.md) was for customers.

**Not in scope:** any controller, service, DTO, or Vue file. No `TicketsModule` is registered yet — `apps/api/src/app.module.ts` is untouched until Story 14. No `AttachmentStorageService` change — that is Story 15's job, done only when the second call site (ticket attachments) actually exists.

## Context — Read These Files First

1. [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma) — read the whole file (281 lines). Study the `Customer` model at lines 191–221 and its three children (`CustomerNote` lines 225–238, `CustomerAttachment` lines 243–259, `CustomerInteraction` lines 264–280) as the direct template for `Ticket`/`TicketComment`/`TicketAttachment`. Study the `User` model's back-relation block at lines 104–109 — you are adding five more relation fields in the same shape.
2. [`.squad/plans/customer-management/09-story-customer-data-model-3.md`](../customer-management/09-story-customer-data-model-3.md) — the story that added the `Customer` family. Its task 1 (enums), task 2 (`Customer` model), task 3 (child models), task 4 (`User` back-relations), task 5 (migration command), and task 6 (permission seeding) are the exact task shape to repeat here.
3. [`apps/api/prisma/seed.ts`](../../../apps/api/prisma/seed.ts) — read in full (264 lines). The `permissions` array (lines 41–58) ends with the six customer-management keys; you append five more after `interactions:write` (line 57). The `roles` array (lines 60–133) is where each role's `permissions: string[]` is edited. `seedBootstrapAdmin` (lines 144–183) and `main()` (lines 185–254) need no changes — `system-administrator` picks up new keys automatically via `permissions.map((permission) => permission.key)` at line 65.
4. [`apps/api/prisma/migrations/`](../../../apps/api/prisma/migrations/) — list the directory. Three migrations exist (`20260825114240_first_migration`, `20260825130849_identity_and_rbac`, `20260825174608_customers_notes_attachments_interactions`). Yours will be the fourth, named `tickets_comments_attachments_history`.
5. `apps/api/package.json` — confirm the scripts you will run: `prisma:migrate` (`prisma migrate dev`), `prisma:generate` (`prisma generate`), `prisma:seed` (`prisma db seed`), `prisma:reset` (`prisma migrate reset`).
6. Grep for `assertExists` in `apps/api/src/customers/customers.service.ts` — the public method (lines 277–288 in the current file) is the pattern Story 14 will replicate for `TicketsService.assertExists`, and Story 15's comment/attachment/history services will call it exactly as Story 11's did for customers. Nothing to change here in this story — read it only to understand what the schema needs to support.

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | `TicketCategory`, `TicketPriority`, `TicketStatus` are Prisma enums, not seeded lookup tables. | Closed sets that drive UI badges and workflow branching — same reasoning as `CustomerStatus`. See [00-overview.md](00-overview.md) product decisions. |
| 2 | `Ticket.customerId` is required and non-nullable, `onDelete: Restrict`. | A ticket must always resolve to a customer. Customers are never deleted (work item 3), so `Restrict` is defensive, not load-bearing. |
| 3 | `Ticket.assignedAgentId` and `createdById` are nullable, `onDelete: SetNull`. | Identical shape to `Customer.assignedAgentId`/`createdById` — an agent leaving the org must not block deleting... but users are deactivated, never deleted, in this codebase, so this is defensive symmetry, not an expected event. |
| 4 | `TicketComment` mirrors `CustomerNote` exactly: `authorId` required, `onDelete: Restrict`, `@@index([ticketId, createdAt])`. | Author-only edit / author-or-elevated-permission delete is enforced in Story 15's service, not the schema — the schema only needs to record who wrote it. |
| 5 | `TicketAttachment` mirrors `CustomerAttachment` field-for-field, including `storageKey String @unique`. | Story 15 generalises `AttachmentStorageService` to write ticket attachment bytes under a `tickets/` prefix instead of `customers/` — the row shape does not change. |
| 6 | `TicketHistory` is new: no equivalent existed in work item 3. `field` is a plain `String`, not an enum. | The set of trackable fields (`status`, `priority`, `category`, `assignedAgentId`) is closed today but a `String` avoids a migration every time a new field becomes worth tracking. `oldValue`/`newValue` are nullable strings holding the raw enum literal or UUID — no display-name resolution at write time. |
| 7 | No `Ticket` unique constraint beyond `id`. | Unlike `Customer.email`, nothing about a ticket is naturally unique — `subject` can legitimately repeat across tickets. |
| 8 | Five new permission keys: `tickets:read`, `tickets:write`, `tickets:manage`, `ticket-comments:write`, `ticket-attachments:write`. | One read key (covers ticket + all three children, same as `customers:read`); one elevated key (`tickets:manage`, plays the role `customers:archive` played, for deleting someone else's comment/attachment); two child-write keys (comments, attachments) — no third child-write key because history has no client-write route. |
| 9 | `crm-manager` gets all five; `support-supervisor` and `support-agent` get four (no `tickets:manage`); `customer` gets none; `reporting-user` gets `tickets:read` only. | Mirrors the exact grant shape work item 3 used for the customer permission keys. |
| 10 | No demo/seed ticket rows. | Same as work item 3 — the seed exists to make the app bootable and permissioned, not to populate business data. |

## Implementation tasks

### 1 — Prisma enums

**File: `apps/api/prisma/schema.prisma`**

Add these three enums directly below the existing `InteractionDirection` enum (after line 36, before the `AppSetting` model at line 41):

```prisma
enum TicketCategory {
  GENERAL
  TECHNICAL
  BILLING
  ACCOUNT
  FEATURE_REQUEST
  BUG_REPORT
  OTHER
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  ON_HOLD
  RESOLVED
  CLOSED
}
```

### 2 — The `Ticket` model

**File: `apps/api/prisma/schema.prisma`**

Append after the `CustomerInteraction` model (after line 280, before the closing of the file):

```prisma
/// A customer support request, tracked from creation through resolution.
/// Never deleted — CLOSED is a normal status, not terminal, so a ticket can be
/// reopened by setting status back to OPEN. Always linked to a Customer.
/// Unlike CustomerInteraction (a logged touchpoint), a Ticket is a trackable
/// unit of work with its own lifecycle, category, priority, and assignment.
model Ticket {
  id              String         @id @default(uuid()) @db.Uuid
  customerId      String         @map("customer_id") @db.Uuid
  subject         String
  description     String
  category        TicketCategory @default(GENERAL)
  priority        TicketPriority @default(MEDIUM)
  status          TicketStatus   @default(OPEN)
  assignedAgentId String?        @map("assigned_agent_id") @db.Uuid
  createdById     String?        @map("created_by_id") @db.Uuid
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  customer      Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  assignedAgent User?    @relation("TicketAssignedAgent", fields: [assignedAgentId], references: [id], onDelete: SetNull)
  createdBy     User?    @relation("TicketCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  comments    TicketComment[]
  attachments TicketAttachment[]
  history     TicketHistory[]

  @@index([status])
  @@index([priority])
  @@index([category])
  @@index([assignedAgentId])
  @@index([customerId])
  @@map("tickets")
}
```

### 3 — Comments, attachments, history

**File: `apps/api/prisma/schema.prisma`**

Append after the `Ticket` model:

```prisma
/// Free-text comment on a ticket. Only the author may edit; the author or a
/// tickets:manage holder may delete — mirrors CustomerNote's authorship rule.
model TicketComment {
  id        String   @id @default(uuid()) @db.Uuid
  ticketId  String   @map("ticket_id") @db.Uuid
  authorId  String   @map("author_id") @db.Uuid
  body      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author User   @relation("TicketCommentAuthor", fields: [authorId], references: [id], onDelete: Restrict)

  @@index([ticketId, createdAt])
  @@map("ticket_comments")
}

/// Metadata for a file stored on disk under the ticket-management feature's
/// storage tree. `storageKey` is generated (uuid + a mime-derived extension) —
/// never the client's filename, which is kept in `fileName` for display only.
/// Story 15 owns the bytes via the generalised AttachmentStorageService.
model TicketAttachment {
  id             String   @id @default(uuid()) @db.Uuid
  ticketId       String   @map("ticket_id") @db.Uuid
  uploadedById   String   @map("uploaded_by_id") @db.Uuid
  fileName       String   @map("file_name")
  storageKey     String   @unique @map("storage_key")
  mimeType       String   @map("mime_type")
  sizeBytes      Int      @map("size_bytes")
  checksumSha256 String   @map("checksum_sha256")
  createdAt      DateTime @default(now()) @map("created_at")

  ticket     Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  uploadedBy User   @relation("TicketAttachmentUploader", fields: [uploadedById], references: [id], onDelete: Restrict)

  @@index([ticketId, createdAt])
  @@map("ticket_attachments")
}

/// A system-generated audit entry, one row per tracked field change (status,
/// priority, category, or assignedAgentId). Never created directly by a
/// client — Story 14's TicketsService writes these as a side effect of the
/// mutation that caused them. Read-only via the API: no create/update/delete
/// route exists on TicketHistoryController.
model TicketHistory {
  id          String   @id @default(uuid()) @db.Uuid
  ticketId    String   @map("ticket_id") @db.Uuid
  changedById String   @map("changed_by_id") @db.Uuid
  field       String
  oldValue    String?  @map("old_value")
  newValue    String?  @map("new_value")
  createdAt   DateTime @default(now()) @map("created_at")

  ticket    Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  changedBy User   @relation("TicketHistoryActor", fields: [changedById], references: [id], onDelete: Restrict)

  @@index([ticketId, createdAt])
  @@map("ticket_history")
}
```

### 4 — Back-relations on `Customer` and `User`

**File: `apps/api/prisma/schema.prisma`**

On the `Customer` model, add one field to its relation block (near line 213, alongside `notes`/`attachments`/`interactions`):

```prisma
  tickets Ticket[]
```

No `@relation` name is needed — `Ticket` has exactly one relation field pointing at `Customer` (`customer`), so Prisma infers the pairing without ambiguity.

On the `User` model, add five fields to its relation block (after line 108, alongside the five customer-management back-relations added in Story 09):

```prisma
  assignedTickets      Ticket[]           @relation("TicketAssignedAgent")
  createdTickets       Ticket[]           @relation("TicketCreatedBy")
  ticketComments       TicketComment[]    @relation("TicketCommentAuthor")
  ticketAttachments    TicketAttachment[] @relation("TicketAttachmentUploader")
  ticketHistoryEntries TicketHistory[]    @relation("TicketHistoryActor")
```

### 5 — Generate the migration

From `apps/api`:

```bash
npm run prisma:migrate -- --name tickets_comments_attachments_history
```

Expect Prisma to generate, in order: three `CREATE TYPE` statements (`TicketCategory`, `TicketPriority`, `TicketStatus`); four `CREATE TABLE` blocks (`tickets`, `ticket_comments`, `ticket_attachments`, `ticket_history`); a unique index `ticket_attachments_storage_key_key`; the five `@@index` entries from tasks 2–3; and eight foreign keys, split `Restrict` (`Ticket.customerId`, all four `authorId`/`uploadedById`/`changedById` references), `SetNull` (`Ticket.assignedAgentId`, `Ticket.createdById`), and `Cascade` (`TicketComment.ticketId`, `TicketAttachment.ticketId`, `TicketHistory.ticketId`). If `prisma migrate dev` does not auto-run the client generator, follow with `npm run prisma:generate`.

If the migration prompts to reset the database (only happens on drift, not expected here), recover with `npm run prisma:seed` — `BOOTSTRAP_ADMIN_PASSWORD` in `apps/api/.env` must be set beforehand or a new password is generated and printed once.

### 6 — Seed the five new permissions

**File: `apps/api/prisma/seed.ts`**

Append to the `permissions` array (lines 41–58), directly after the `interactions:write` entry at line 57:

```ts
  { key: 'tickets:read', description: 'View tickets, their comments, attachments, and history' },
  { key: 'tickets:write', description: 'Create and update tickets, including status' },
  { key: 'tickets:manage', description: 'Delete a ticket comment or attachment created by someone else' },
  { key: 'ticket-comments:write', description: 'Add, edit, and delete ticket comments' },
  { key: 'ticket-attachments:write', description: 'Upload and delete ticket attachments' },
```

The catalogue goes from 16 → 21 keys.

Edit the `roles` array (lines 60–133), adding to each role's `permissions` list:

- `crm-manager` (lines 67–89): append all five new keys.
- `support-supervisor` (lines 90–106): append `tickets:read`, `tickets:write`, `ticket-comments:write`, `ticket-attachments:write` (no `tickets:manage`).
- `support-agent` (lines 107–120): append the same four as `support-supervisor`.
- `customer` (lines 121–126): no change — stays empty.
- `reporting-user` (lines 127–132): append `tickets:read` only.

`system-administrator` (lines 61–66) needs no edit — it grants `permissions.map((permission) => permission.key)`, so it auto-picks up all five.

No other part of `seed.ts` changes. The idempotent grant-replacement transaction (lines 233–238) and `seedBootstrapAdmin` (lines 144–183) are untouched.

## Edge Cases & Failure Modes

- **A ticket referencing a nonexistent `customerId`** cannot occur at the schema level — the `Restrict` foreign key rejects it. Story 14's service is responsible for a friendly `400` before that constraint is ever hit.
- **Deleting a customer** is not a route that exists (work item 3), so `Ticket.customerId`'s `onDelete: Restrict` is defensive and not expected to fire in normal operation — it exists so that if a future story ever adds customer deletion, it fails loudly instead of silently orphaning tickets.
- **`TicketHistory.field` is an unvalidated `String`** at the database level — Story 14's service is the only writer and is trusted to use consistent values (`'status'`, `'priority'`, `'category'`, `'assignedAgentId'`). A typo here does not break the schema, only readability of the audit trail; Story 14's Test Plan should assert the exact literal values written.
- **`oldValue`/`newValue` nullability**: both are nullable to accommodate `assignedAgentId` transitions to/from `null` (unassigned) — a status/priority/category change never produces a null on either side since those fields always have a value (defaults), but the column stays nullable rather than having two narrower column types for one narrow case.
- **Enum renames are breaking changes** — same caveat work item 3 recorded for `CustomerStatus`. `TicketCategory`/`TicketPriority`/`TicketStatus` values travel as string literals through the API and the `TicketHistory.oldValue`/`newValue` columns; renaming a value after tickets exist orphans historical string comparisons.
- **Migration run against a database with no `users`/`customers` tables** is not a real scenario in a correct migration history — the `Restrict`/`SetNull` foreign keys would fail loudly on `prisma migrate dev` if the referenced tables were missing, which is the desired failure mode (loud, not silent).
- **Partially applied migration**: Prisma wraps the generated SQL in a transaction for PostgreSQL, so there is no half-applied state to recover from — either the whole migration file applies or none of it does.

## Test Plan

1. **No new unit test.** The schema is declarative; nothing to unit-test in this story, consistent with Story 09.
2. **Integration — extend `apps/api/test/seed.e2e-spec.ts`.** Add assertions that: `permission.count()` is 21 with all five new keys present; `system-administrator` holds all 21; `support-agent` and `support-supervisor` hold the four ticket keys but not `tickets:manage`; `customer` role has zero ticket permissions; `reporting-user` holds `tickets:read` only, not `tickets:write`; re-running the seed (`npm run prisma:seed` twice) leaves `permission.count()` unchanged (idempotency).
3. **Integration — new file `apps/api/test/tickets-schema.e2e-spec.ts`.** Direct `PrismaClient`, no HTTP, modelled on `apps/api/test/customers-schema.e2e-spec.ts`. Create a fixture customer first (name prefixed `E2E `), then: creating a ticket with only `customerId`/`subject`/`description` defaults to `category: GENERAL`, `priority: MEDIUM`, `status: OPEN`; a ticket referencing an unknown `customerId` throws a Prisma foreign-key error (`P2003`); attaching a `TicketComment`/`TicketAttachment`/`TicketHistory` row and reading it back via `include` round-trips correctly; deleting a ticket (via a direct `prisma.ticket.delete`, not an API route) cascades its comments/attachments/history to zero rows; a `TicketComment` with an unknown `authorId` throws `P2003`; `ticketHistory.findMany({ orderBy: { createdAt: 'desc' } })` returns newest-first. Clean up with `prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } })` and the fixture customer, mirroring the cleanup pattern in `customers-schema.e2e-spec.ts`.
4. **No frontend test** — Story 16 owns the frontend.

## Migration / Rollback

**Forward:** `npm run prisma:migrate -- --name tickets_comments_attachments_history` from `apps/api`, then `npm run prisma:seed`.

**Rollback (only if this story must be reverted before Story 14 starts):**
1. Delete the generated migration directory under `apps/api/prisma/migrations/`.
2. Revert the `schema.prisma` and `seed.ts` edits (tasks 1–4 and 6 above).
3. Against the database directly:
   ```sql
   DROP TABLE ticket_history, ticket_attachments, ticket_comments, tickets CASCADE;
   DROP TYPE "TicketStatus", "TicketPriority", "TicketCategory";
   DELETE FROM permissions WHERE key IN (
     'tickets:read', 'tickets:write', 'tickets:manage',
     'ticket-comments:write', 'ticket-attachments:write'
   );
   DELETE FROM _prisma_migrations WHERE migration_name LIKE '%tickets_comments_attachments_history';
   ```
4. `npm run prisma:generate` to regenerate the Prisma client without the removed types.

**Half-applied state:** not reachable — PostgreSQL DDL migrations run transactionally under Prisma, so a failed `prisma migrate dev` leaves the previous schema intact with no partial tables.

## Verification Steps

1. **Schema compiles:** `npx prisma validate` from `apps/api`.
2. **Migration applies cleanly:** `npm run prisma:migrate -- --name tickets_comments_attachments_history` from `apps/api` against a running PostgreSQL instance; confirm no reset prompt.
3. **Client regenerates:** `npm run prisma:generate`; confirm `@prisma/client` exports `Ticket`, `TicketComment`, `TicketAttachment`, `TicketHistory`, `TicketCategory`, `TicketPriority`, `TicketStatus`.
4. **Seed runs:** `npm run prisma:seed`; confirm the console summary reports `permissions: 21`.
5. **Integration tests:** `npm run test:e2e --workspace @crm/api` — confirm `seed.e2e-spec.ts` and the new `tickets-schema.e2e-spec.ts` pass.
6. **`npx prisma migrate status`** from `apps/api` reports no pending migrations.
7. **Typecheck/lint/build the whole repo:** `npm run typecheck`, `npm run lint`, `npm run build` from the repo root — confirm no other package references the changed files yet (Story 14 is where consumers appear).
8. **Manual spot-check:** `npm run prisma:studio` from `apps/api`, confirm the `tickets`, `ticket_comments`, `ticket_attachments`, `ticket_history` tables exist with the expected columns and that `permissions` lists all five new keys.

## Done Criteria

- [ ] `schema.prisma` has the three new enums and four new models, plus the `Customer.tickets` and five `User` back-relation fields.
- [ ] The migration `tickets_comments_attachments_history` is generated and applied.
- [ ] `seed.ts` seeds five new permission keys and grants them per the role table in Product rules.
- [ ] `seed.e2e-spec.ts` and the new `tickets-schema.e2e-spec.ts` pass.
- [ ] `npx prisma migrate status` reports nothing pending.
- [ ] No controller, service, DTO, or Vue file was touched in this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 14.**
