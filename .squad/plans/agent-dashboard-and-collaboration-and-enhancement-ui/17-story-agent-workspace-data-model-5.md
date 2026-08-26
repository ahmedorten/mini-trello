# Story 17 — Agent workspace & communication data model (Story: 5)

## Prerequisites

- [Story 16 completed](../ticket-management/16-story-frontend-ticket-management-4.md) — work item 4 is closed. Every table this story extends (`tickets`, `ticket_history`, `customer_interactions`) already exists.
- PostgreSQL running and reachable through `DATABASE_URL` in `apps/api/.env`.
- The seeded administrator's password known (`BOOTSTRAP_ADMIN_PASSWORD`, or the value printed on first seed).
- **This is the only story in work item 5 that creates a migration.** Stories 18–21 read the tables created here and must not add columns.

---

## Story Goal

Extend the existing schema with the four things the agent workspace needs and nothing more:

1. **Communication channels** — `InteractionChannel` gains `WHATSAPP`, `SMS`, and `WEB_FORM` so the five channels the intake names (Email, WhatsApp, Live Chat, SMS, Web Forms) are all representable. `CHAT` **is** Live Chat; no new value for it.
2. **Interaction to ticket link** — `CustomerInteraction` gains a **nullable** `ticketId`, so an interaction can be attributed to a ticket as well as to its customer.
3. **Agent tasks and reminders** — a new `AgentTask` model, optionally linked to a ticket and/or a customer.
4. **Quick replies** — a new `QuickReply` model, keyed per locale, so the workspace can offer canned responses in English and Arabic.

Plus the seed changes: **seven new permission keys** with their role grants, and a seeded starter set of quick replies.

**Not in scope:** any API route (Stories 18–19), any frontend file (Stories 20–21), external communication providers of any kind, SLA/due-date fields on `Ticket` (see Product rules), and any change to an existing column's type or nullability.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — the whole file (406 lines). Specifically: the enum block ~lines 10–61 (`InteractionChannel` at **25–31** is the one you extend); `User` at **109–145**, whose back-relation block at **129–139** is where the three new `AgentTask`/`QuickReply` back-relations go; `Customer` at **222–253** (relation list **244–247**); `CustomerInteraction` at **296–312**, including the doc comment at 293–295 explaining why `occurredAt` and `createdAt` differ — the timeline in Story 19 still sorts on `occurredAt`; `Ticket` at **319–346** (relation list **336–338**); `TicketHistory` at **392–406**, the precedent for a system-written audit row.
2. [`.squad/plans/ticket-management/13-story-ticket-data-model-4.md`](../ticket-management/13-story-ticket-data-model-4.md) — the direct precedent for this story. Its task order (enums, then models, then back-relations, then migration, then seed permissions, then seed role grants) is the order to follow here, and its Edge Cases section is the template for this one's.
3. `apps/api/prisma/seed.ts` — read it end to end (281 lines). The `permissions` array at **41–63** (append to it), the `roles` array at **65–151** (six role objects: `system-administrator` **67–72**, whose grant list is `permissions.map(...)` and therefore needs **no** edit; `crm-manager` **73–100**; `support-supervisor` **101–121**; `support-agent` **122–139**; `customer` **140–145**; `reporting-user` **146–150**), and `main()` at **203–272** — the per-role "delete-then-recreate grants inside one `$transaction`" block in the role loop is what makes a removed key actually revoke.
4. `apps/api/prisma/migrations/20260825194159_tickets_comments_attachments_history/migration.sql` — read the first 40 lines. This is the shape Prisma generates: `CreateEnum` first, then `CreateTable`, then indexes, then `AddForeignKey`. Your generated file must look like this. **Do not hand-write it** — generate it.
5. `apps/api/src/customers/dto/interaction.dto.ts` — full file (62 lines). `CreateInteractionDto` (lines 6–33) and `InteractionResponseDto` (35–62) are **not** changed in this story, but read them so you understand what Story 19 will add (`ticketId`) once the column exists.
6. `apps/api/src/tickets/tickets.service.ts` lines **11–35** — `TICKET_MANAGE_PERMISSION` and the `TICKET_SELECT` projection. Story 18 adds `tickets:assign` beside `tickets:manage`; the constant here shows the naming convention (a `SCREAMING_SNAKE` export of the literal string).
7. `apps/api/src/auth/decorators/require-permissions.decorator.ts` lines **4–9**. The doc comment is explicit: **a permission key that is not in the seeded catalogue is an endpoint nobody can ever call.** Every key you add here is consumed by Stories 18–19; a typo is a silent 403.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | `InteractionChannel` is **extended**, not replaced. Existing values `PHONE`, `EMAIL`, `CHAT`, `MEETING`, `OTHER` keep their meaning; `CHAT` is presented as "Live Chat". Three values are added: `WHATSAPP`, `SMS`, `WEB_FORM`. | Enum values already exist in rows written by work item 3. Renaming `CHAT` to `LIVE_CHAT` would need a data migration for a label the frontend can supply from a translation key instead. |
| 2 | `CustomerInteraction.ticketId` is **nullable** with `onDelete: SetNull`. An interaction always has a customer; a ticket is optional context. | A phone call logged before any ticket exists must still be recordable — that is the existing behaviour and it must not regress. `SetNull` matches how `Customer.assignedAgentId` and `Ticket.assignedAgentId` already behave. |
| 3 | **No `dueAt`, SLA, or escalation field is added to `Ticket`.** "Overdue" is derived in Story 18 from `priority` + `updatedAt` against a single constant table. | Work item 4's overview records "No SLA tracking, due dates, or escalation rules" as a deliberate exclusion. The intake asks for an *indicator*, not a configurable SLA engine — a derived threshold delivers the indicator with no schema surface, no admin UI, and no backfill. |
| 4 | `AgentTask` carries its own `dueAt` **and** `remindAt`. `remindAt` is a plain timestamp the UI reads; **nothing schedules or sends anything.** | "Tasks and reminders" needs a reminder time to be storable and surfaced on the dashboard. A scheduler or notification transport is not requested and would need infrastructure this work item excludes. |
| 5 | `AgentTask.assigneeId` and `AgentTask.createdById` are both **required**, both `onDelete: Restrict`. | Mirrors `CustomerNote.authorId` (schema line 266) and `TicketComment.authorId` (line 359): a task must always have an owner and an audit trail, and deleting a user must not silently destroy either. Users are deactivated, never deleted, throughout this project. |
| 6 | `AgentTask.ticketId` and `AgentTask.customerId` are both **nullable** — `SetNull` and `Cascade` respectively. | A standalone reminder ("call back the Cairo branch") needs neither. `customerId` cascades because a customer row is never deleted (terminal state is `ARCHIVED`), so the cascade is unreachable in practice and matches `CustomerNote`'s existing choice. `ticketId` sets null because tickets are likewise never deleted. |
| 7 | `QuickReply` is keyed `@@unique([key, locale])`, not one row with `bodyEn`/`bodyAr` columns. | Adding a third language must not need a migration. It also lets a locale be *missing* — Story 21 falls back to the `en` row, matching `fallbackLocale: 'en'` in the frontend i18n config. |
| 8 | `QuickReply.channel` is a **nullable** `InteractionChannel`. Null means "any channel". | A greeting is channel-agnostic; an SMS-length reply is not. Nullable keeps both expressible without a join table. |
| 9 | Seven new permission keys: `dashboard:read`, `tasks:read`, `tasks:write`, `tasks:manage`, `quick-replies:read`, `quick-replies:write`, `tickets:assign`. | `reports:read` already exists but is **not** granted to `support-agent` (seed lines 122–139), and the agent dashboard must be reachable by an agent — reusing `reports:read` would either lock agents out or silently widen a reporting permission. `tasks:manage` plays the same "act on someone else's row" role `tickets:manage` plays. `tickets:assign` is the reassignment gate Story 18 enforces. |
| 10 | `support-agent` gets `dashboard:read`, `tasks:read`, `tasks:write`, `quick-replies:read` — **not** `tasks:manage`, **not** `tickets:assign`, **not** `quick-replies:write`. | A front-line agent manages their own tasks and reads the canned-reply catalogue. Reassigning someone else's ticket and editing the shared catalogue are supervisor actions. |
| 11 | Seeded quick replies are **upserted on `[key, locale]`** like every other seeded row, so re-running the seed re-syncs bodies without duplicating. | Matches the `settings`/`permissions`/`roles` loops in `main()` exactly. |

---

## Backend Tasks

### 1 — Extend `InteractionChannel`

**File: `apps/api/prisma/schema.prisma`** (enum at lines 25–31).

```prisma
/// How a touchpoint reached us. `CHAT` is live chat (kept for rows written by
/// work item 3); `WEB_FORM` is a public web-form submission. Extended in work
/// item 5 to cover the five channels the agent workspace surfaces.
enum InteractionChannel {
  PHONE
  EMAIL
  CHAT
  MEETING
  OTHER
  WHATSAPP
  SMS
  WEB_FORM
}
```

**Append the three new values at the end.** Do **not** reorder the existing five — display order is the frontend's job (Story 20's `INTERACTION_CHANNELS` constant), and reordering a PostgreSQL enum requires recreating the type.

### 2 — Link `CustomerInteraction` to a ticket

**File: `apps/api/prisma/schema.prisma`** (model at lines 296–312).

Add the column, the relation, and one index:

```prisma
  ticketId    String?              @map("ticket_id") @db.Uuid
  ...
  ticket    Ticket?  @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  ...
  @@index([customerId, occurredAt])
  @@index([ticketId, occurredAt])
```

Then add the back-relations to **`Ticket`** (relation list at 336–338):

```prisma
  interactions CustomerInteraction[]
  agentTasks   AgentTask[]
```

### 3 — `AgentTaskStatus` enum and the `AgentTask` model

**File: `apps/api/prisma/schema.prisma`.** Put the enum with the other enums (after `TicketStatus`, line 61) and the model after `TicketHistory` (line 406).

```prisma
/// Lifecycle of an agent's own to-do. A closed set that drives dashboard
/// counters and badge colour, so an enum rather than a seeded lookup row —
/// the same reasoning that made TicketStatus an enum in work item 4.
enum AgentTaskStatus {
  OPEN
  IN_PROGRESS
  DONE
  CANCELLED
}
```

```prisma
/// A support agent's own to-do or reminder, optionally hung off a ticket and/or
/// a customer. `remindAt` is a timestamp the UI reads to surface a task early —
/// NOTHING schedules, pushes, or emails from it (Product rule 4). `dueAt` is
/// what "overdue" means for a task; a ticket's overdue-ness is derived instead
/// (Product rule 3), so the two concepts deliberately do not share a column.
model AgentTask {
  id          String          @id @default(uuid()) @db.Uuid
  title       String
  notes       String?
  status      AgentTaskStatus @default(OPEN)
  dueAt       DateTime?       @map("due_at")
  remindAt    DateTime?       @map("remind_at")
  completedAt DateTime?       @map("completed_at")
  assigneeId  String          @map("assignee_id") @db.Uuid
  createdById String          @map("created_by_id") @db.Uuid
  ticketId    String?         @map("ticket_id") @db.Uuid
  customerId  String?         @map("customer_id") @db.Uuid
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")

  assignee  User      @relation("AgentTaskAssignee", fields: [assigneeId], references: [id], onDelete: Restrict)
  createdBy User      @relation("AgentTaskCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  ticket    Ticket?   @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  customer  Customer? @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([assigneeId, status])
  @@index([assigneeId, dueAt])
  @@index([ticketId])
  @@index([customerId])
  @@map("agent_tasks")
}
```

The `[assigneeId, status]` and `[assigneeId, dueAt]` composite indexes are the two Story 18's dashboard query and Story 19's task list actually use — do **not** add a bare `@@index([status])`.

### 4 — The `QuickReply` model

**File: `apps/api/prisma/schema.prisma`**, after `AgentTask`.

```prisma
/// A canned response an agent can drop into a comment or an outbound
/// interaction. Keyed by (key, locale) so a third language needs a seed row,
/// not a migration (Product rule 7). `channel: null` means "any channel".
model QuickReply {
  id          String              @id @default(uuid()) @db.Uuid
  key         String
  locale      String
  title       String
  body        String
  channel     InteractionChannel?
  isActive    Boolean             @default(true) @map("is_active")
  createdById String?             @map("created_by_id") @db.Uuid
  createdAt   DateTime            @default(now()) @map("created_at")
  updatedAt   DateTime            @updatedAt @map("updated_at")

  createdBy User? @relation("QuickReplyCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  @@unique([key, locale])
  @@index([locale, isActive])
  @@map("quick_replies")
}
```

`createdById` is **nullable** here, unlike `AgentTask.createdById`: seeded rows have no author.

### 5 — `User` and `Customer` back-relations

**File: `apps/api/prisma/schema.prisma`.**

In **`User`**, append to the back-relation block at lines 135–139:

```prisma
  agentTasks        AgentTask[]  @relation("AgentTaskAssignee")
  createdAgentTasks AgentTask[]  @relation("AgentTaskCreatedBy")
  quickReplies      QuickReply[] @relation("QuickReplyCreatedBy")
```

In **`Customer`**, append to the relation list at lines 244–247:

```prisma
  agentTasks AgentTask[]
```

`prisma validate` fails loudly if any of these is missing — run it before generating the migration.

### 6 — Generate the migration

From `apps/api`:

```bash
npm run prisma:migrate -- --name agent_workspace_tasks_quick_replies
```

Then **read the generated `migration.sql`** and confirm all five of these are present:

- `ALTER TYPE "InteractionChannel" ADD VALUE 'WHATSAPP';` and the same for `'SMS'` and `'WEB_FORM'`
- `CREATE TYPE "AgentTaskStatus" AS ENUM (...)`
- `ALTER TABLE "customer_interactions" ADD COLUMN "ticket_id" UUID;`
- `CREATE TABLE "agent_tasks"` and `CREATE TABLE "quick_replies"`
- the four `agent_tasks` indexes, the `quick_replies_key_locale_key` unique index, and the `customer_interactions_ticket_id_occurred_at_idx` index

**If `prisma migrate dev` fails with `unsafe use of new value ... of enum type`**, split the file: move the three `ALTER TYPE ... ADD VALUE` statements into their own earlier migration directory and leave the rest in this one. See Edge Cases for why this can happen.

Then regenerate the client:

```bash
npm run prisma:generate
```

### 7 — Seed the seven new permission keys

**File: `apps/api/prisma/seed.ts`** — append to the `permissions` array (it ends at line 63), after `ticket-attachments:write`:

```ts
  { key: 'dashboard:read', description: 'View the agent dashboard and its ticket insights' },
  { key: 'tasks:read', description: 'View agent tasks and reminders' },
  { key: 'tasks:write', description: 'Create, update, and delete your own agent tasks' },
  { key: 'tasks:manage', description: 'Update or delete an agent task assigned to someone else' },
  { key: 'quick-replies:read', description: 'View the quick-reply catalogue' },
  { key: 'quick-replies:write', description: 'Create, update, and delete quick replies' },
  { key: 'tickets:assign', description: 'Assign a ticket to a user other than yourself' },
```

`system-administrator` picks all seven up automatically — its grant list is `permissions.map((permission) => permission.key)` at line 71. **Do not edit it.**

### 8 — Seed the role grants

**File: `apps/api/prisma/seed.ts`**, in the `roles` array (lines 65–151).

- **`crm-manager`** (grant list 76–99) — append all seven: `'dashboard:read'`, `'tasks:read'`, `'tasks:write'`, `'tasks:manage'`, `'quick-replies:read'`, `'quick-replies:write'`, `'tickets:assign'`.
- **`support-supervisor`** (105–120) — append `'dashboard:read'`, `'tasks:read'`, `'tasks:write'`, `'tasks:manage'`, `'quick-replies:read'`, `'tickets:assign'`. **Not** `quick-replies:write`.
- **`support-agent`** (127–138) — append `'dashboard:read'`, `'tasks:read'`, `'tasks:write'`, `'quick-replies:read'`. **Nothing else** (Product rule 10).
- **`reporting-user`** (line 149) — append `'dashboard:read'` only.
- **`customer`** (line 144) — unchanged, stays `[]`.

### 9 — Seed a starter quick-reply catalogue

**File: `apps/api/prisma/seed.ts`.** Add the data array next to `branches` (lines 158–160):

```ts
const quickReplies: {
  key: string;
  locale: string;
  title: string;
  body: string;
  channel: string | null;
}[] = [
  { key: 'greeting', locale: 'en', title: 'Greeting', body: 'Hello, thank you for contacting Customer Support. How can I help you today?', channel: null },
  { key: 'greeting', locale: 'ar', title: 'ترحيب', body: 'مرحباً، شكراً لتواصلك مع خدمة العملاء. كيف يمكنني مساعدتك؟', channel: null },
  { key: 'investigating', locale: 'en', title: 'Investigating', body: 'Thank you for the details. I am looking into this now and will update you shortly.', channel: null },
  { key: 'investigating', locale: 'ar', title: 'جاري الفحص', body: 'شكراً على التفاصيل. أقوم بمراجعة الأمر الآن وسأوافيك بالتحديث قريباً.', channel: null },
  { key: 'need-more-info', locale: 'en', title: 'Need more information', body: 'Could you please share a screenshot and the exact time the issue happened?', channel: null },
  { key: 'need-more-info', locale: 'ar', title: 'نحتاج معلومات إضافية', body: 'هل يمكنك إرسال صورة للشاشة والوقت الذي حدثت فيه المشكلة؟', channel: null },
  { key: 'resolved', locale: 'en', title: 'Resolved', body: 'This has now been resolved. Please let us know if anything else comes up.', channel: null },
  { key: 'resolved', locale: 'ar', title: 'تم الحل', body: 'تم حل المشكلة. برجاء إخبارنا إذا واجهت أي أمر آخر.', channel: null },
  { key: 'sms-ack', locale: 'en', title: 'SMS acknowledgement', body: 'We received your message and a support agent will reply shortly.', channel: 'SMS' },
  { key: 'sms-ack', locale: 'ar', title: 'إشعار استلام SMS', body: 'تم استلام رسالتك وسيقوم أحد موظفي الدعم بالرد قريباً.', channel: 'SMS' },
];
```

And the upsert loop inside `main()` (203–272), placed **after** the `branches` loop and **before** the `roles` loop:

```ts
  for (const reply of quickReplies) {
    await prisma.quickReply.upsert({
      where: { key_locale: { key: reply.key, locale: reply.locale } },
      update: { title: reply.title, body: reply.body, channel: reply.channel as never },
      create: { ...reply, channel: reply.channel as never },
    });
  }
```

Finally, extend the closing count log at the end of `main()` (the `Promise.all` of `count()` calls, ~lines 260–271) with `prisma.quickReply.count()` and report it as `quick_replies: ${quickReplyCount}` — the seed's own smoke signal, same as every other table there.

### 10 — Bump the schema version setting

**File: `apps/api/prisma/seed.ts`**, `settings` array line 9: change `{ key: 'app.schemaVersion', value: '1' }` to `value: '2'`. The `settings` loop upserts on `key` and updates `value`, so this re-syncs on an existing database.

---

## Edge Cases & Failure Modes

- **`ALTER TYPE ... ADD VALUE` inside a transaction.** Prisma wraps a migration in one transaction. PostgreSQL 12+ permits adding an enum value inside a transaction but **forbids using it in the same transaction**. Nothing in this migration uses `WHATSAPP`/`SMS`/`WEB_FORM` as a column default or in a `CHECK`, so it succeeds. If a future edit adds such a default and the migration fails with `unsafe use of new value`, the fix is to split the `ALTER TYPE` statements into their own preceding migration directory — which is why task 6 requires **reading** the generated SQL rather than assuming it.
- **An existing `customer_interactions` row.** `ticket_id` is added as a nullable column with no default, so every existing row gets `NULL` and no backfill runs. This is correct: work item 3's interactions predate tickets. Enforced by the `String?` in task 2.
- **An `AgentTask` whose assignee is deactivated.** `onDelete: Restrict` prevents deletion, and this project deactivates rather than deletes (`User.isActive`, schema line 114), so the task stays visible with a deactivated assignee. **Story 19's list must not filter on `assignee.isActive`**, or a deactivated agent's backlog becomes invisible instead of reassignable.
- **A task pointing at a ticket whose customer differs from `AgentTask.customerId`.** The schema cannot express that constraint. **Story 19's service must reject the mismatch at write time**; there is no database guard. Flagged here so Story 19 does not assume one exists.
- **A `QuickReply` row for `ar` missing while `en` exists.** Legal by design (Product rule 7). Story 21 falls back to the `en` row. `@@unique([key, locale])` permits it; there is no `@@unique([key])`.
- **Two seed runs in a row.** Every loop is an upsert keyed on a unique column (`app_settings.key`, `permissions.key`, `roles.key`, `quick_replies.key_locale`), and the role-grant rewrite is a `deleteMany` + `createMany` inside one `$transaction` in `main()`, so a role is never briefly permission-less. Re-running is safe and re-syncs changed text.
- **Removing a permission key from `seed.ts` later.** The grant rewrite revokes it, but the `permissions` row itself is never deleted — a stale orphan permission stays in the catalogue. Same pre-existing behaviour as work items 2–4; not fixed here.
- **A migration applied to a database where `quick_replies` already exists** (a half-applied earlier attempt) — `prisma migrate dev` reports drift and offers a reset. See Migration / Rollback.
- **Unicode in the Arabic seed bodies.** PostgreSQL stores them as UTF-8 `TEXT`. `seed.ts` must be saved **UTF-8 without a BOM** — `.editorconfig` in the repo root governs this. A BOM makes the first import line a syntax error under `ts-node`.
- **`prisma validate` passing but `prisma generate` producing a client without `agentTask`.** Means the back-relations in task 5 were added to `User`/`Customer` but the migration was never applied. Always run `prisma:generate` **after** `prisma:migrate`, in that order.

---

## Test Plan

1. **`apps/api/test/agent-workspace-schema.e2e-spec.ts`** (new). Modelled on `apps/api/test/tickets-schema.e2e-spec.ts`. Cover, against a real database via `PrismaClient`:
   - `agent_tasks` and `quick_replies` exist and accept an insert with only their required columns (`title`, `assigneeId`, `createdById` for a task; `key`, `locale`, `title`, `body` for a reply).
   - `AgentTask.status` defaults to `OPEN`; `QuickReply.isActive` defaults to `true`.
   - inserting a second `QuickReply` with the same `(key, locale)` violates the unique index; the same `key` with a different `locale` succeeds.
   - `customer_interactions.ticket_id` accepts `NULL` and accepts a valid ticket id; an unknown uuid violates the foreign key.
   - all **eight** `InteractionChannel` values, including the three new ones, are accepted on a `customerInteraction` insert.
   - the new `customer_interactions` foreign key is declared `SET NULL` — assert by querying `information_schema.referential_constraints` for `delete_rule = 'SET NULL'` on that constraint, rather than by deleting a ticket (tickets are never deleted in this project).
2. **`apps/api/test/seed.e2e-spec.ts`** (extend the existing file). Add: all seven new permission keys exist in `permissions`; `support-agent` holds exactly `dashboard:read`, `tasks:read`, `tasks:write`, `quick-replies:read` from the new set and **none** of `tasks:manage`, `tickets:assign`, `quick-replies:write`; `crm-manager` holds all seven; `reporting-user` holds `dashboard:read` and no other new key; `customer` holds none; `system-administrator`'s grant count equals `permissions.length`; at least ten `quick_replies` rows exist and every `key` has both an `en` and an `ar` row; `app.schemaVersion` is `'2'`.
3. **Re-run idempotence** (same spec). Run the seed twice — `npm run prisma:seed` twice, or import and call `main()` twice — and assert the `quick_replies` count is unchanged and `support-agent`'s grant set is identical.
4. **No unit spec for the schema.** There is no service to unit-test in this story. Stories 18–19 own the `*.service.spec.ts` files.

---

## Migration / Rollback

**Forward:**

```bash
cd apps/api
npm run prisma:migrate -- --name agent_workspace_tasks_quick_replies
npm run prisma:generate
npm run prisma:seed
```

**What a half-applied state looks like.** The migration is a single transaction, so either all of it lands or none does — *except* the enum extension, which PostgreSQL may commit separately if the split described in task 6 was needed. If `agent_tasks` is missing but `InteractionChannel` already has `WHATSAPP`, the enum values are harmless leftovers: re-running `prisma migrate dev` re-derives the diff from the actual database state and generates only the remainder.

**Rollback.** There is no down-migration in Prisma. To undo in development:

```bash
cd apps/api
npm run prisma:reset      # drops, re-migrates from scratch, re-seeds
```

Do **not** hand-drop `agent_tasks`/`quick_replies` and leave the `_prisma_migrations` row in place — that is exactly the drift state above. **A PostgreSQL enum value cannot be removed at all**; a genuine rollback of task 1 requires recreating the type, which `prisma:reset` does for free and a hand-edit does not. Because this story adds only nullable columns and new tables, the API from work item 4 keeps running unchanged against the migrated database — the rollback pressure is low.

---

## Verification Steps

1. **Schema valid:** `npx prisma validate` in `apps/api`.
2. **Migration applies cleanly:** `npm run prisma:migrate -- --name agent_workspace_tasks_quick_replies` in `apps/api`, then **read the generated `migration.sql`** and confirm the five items listed in task 6.
3. **Client regenerated:** `npm run prisma:generate` in `apps/api`.
4. **Seed runs:** `npm run prisma:seed` in `apps/api`; confirm the closing log reports `permissions: 28` (21 existing + 7 new) and a non-zero `quick_replies` count.
5. **Seed is idempotent:** run `npm run prisma:seed` a second time; confirm the same counts and no unique-constraint error.
6. **Backend builds:** `npm run build --workspace @crm/api`.
7. **Typecheck:** `npm run typecheck --workspace @crm/api`.
8. **Lint:** `npm run lint --workspace @crm/api`.
9. **Unit tests:** `npm run test --workspace @crm/api` — every existing spec must still pass; this story changes no service.
10. **Regression, E2E:** `npm run test:e2e --workspace @crm/api`. The new schema spec plus every existing suite (`auth`, `users`, `org`, `customers`, `customer-children`, `tickets`, `ticket-children`, `seed`) must pass — **the regression signal for this story is that work items 1–4 are untouched.**
11. **Regression on interactions:** confirm `POST /api/customers/:id/interactions` still succeeds with no `ticketId` in the body. Sending `ticketId` today returns `400` under `forbidNonWhitelisted` because the DTO does not accept it yet — that is expected and correct at this point; Story 19 adds it.
12. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.

---

## Done Criteria

- [ ] `InteractionChannel` has eight values; the original five are unmoved and `WHATSAPP`/`SMS`/`WEB_FORM` are appended.
- [ ] `CustomerInteraction` has a nullable `ticketId` with `onDelete: SetNull` and a `[ticketId, occurredAt]` index; `Ticket` has the `interactions` back-relation.
- [ ] `AgentTaskStatus`, `AgentTask`, and `QuickReply` exist with the exact fields, defaults, nullability, relation actions, and indexes specified above.
- [ ] `User` has the three new back-relations; `Customer` has `agentTasks`.
- [ ] Exactly one new migration directory exists and its SQL was read, not assumed.
- [ ] Seven new permission keys are seeded with role grants matching Product rules 9–10 — in particular `support-agent` has **none** of `tasks:manage`, `tickets:assign`, `quick-replies:write`.
- [ ] At least ten quick replies are seeded, every `key` present in both `en` and `ar`.
- [ ] `app.schemaVersion` is `'2'`.
- [ ] The new schema e2e spec and the extended seed spec pass; **every pre-existing api spec and e2e suite still passes**.
- [ ] Full-repo typecheck/lint/test/build pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 18.**
