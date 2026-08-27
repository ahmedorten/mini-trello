# Story 25 — Backend stabilization: deterministic list sorting, index review, and dev test-user seeding (Story: 13)

## Prerequisites

- [Story 24 completed](../communication-channels/24-story-frontend-conversation-timeline-6.md): work items 01–06 are all shipped. This story is the first of five that make up work item 13.
- **The repository is green before you touch it, and that is a verified fact, not an assumption.** `npm run typecheck` exits 0; `npm run test --workspace @crm/api` reports **34 suites / 406 tests passed**; `npm run test --workspace @crm/web` reports **50 files / 523 tests passed**. Re-run all three before your first edit. If any is red on a clean checkout, stop and report — that is a different story than this one.
- PostgreSQL running, `apps/api/.env` present with `DATABASE_URL`, `JWT_ACCESS_SECRET`, `UPLOAD_DIR`, and `MAX_UPLOAD_BYTES`.
- **This story owns the only migration in work item 13.** Stories 26–29 must not create one.
- **No frontend file may be edited in this story.** `apps/web/` is untouched — a checkable claim (`git diff --name-only` must not list a path under `apps/web/`).

---

## Story Goal

The backend half of the stabilization pass. Work item 13's review objectives are mostly already satisfied by the existing code — this story closes the four gaps the review actually found, and nothing else:

1. **Sorting.** No list endpoint accepts a sort parameter today. All four paginated lists have a hard-coded `orderBy`: `customers.service.ts:90`, `tickets.service.ts:84`, `users.service.ts:85`, `agent-tasks.service.ts:93`. Add an opt-in, whitelisted `sort` + `order` pair to each, so Story 26 can build sortable column headers against a real contract.
2. **Deterministic pagination.** `tickets.service.ts:84` orders by `createdAt: 'desc'` and nothing else. Two tickets created in the same millisecond have no defined relative order, so Postgres may order them differently between the page-1 and page-2 queries — which duplicates one row on both pages and drops the other entirely. Every sort gains a unique tie-breaker.
3. **Indexes.** `Ticket` orders every list page by `createdAt` and has **no index on `createdAt`**; `User` orders by `fullName` and has **no index on `fullName`**. Add the indexes that back the default and newly sortable orderings. One migration, indexes only.
4. **Dev test users.** The seed creates exactly one user — the bootstrap administrator (`seed.ts:216–256`). The `support-agent` and `customer` roles are seeded but no account holds them, so there is nothing for Story 28's test-user picker to authenticate as. Add an opt-in, development-only block that seeds one account per persona.

**Explicitly reviewed and found already correct — change nothing here:** the global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` (`main.ts:27–34`); `AllExceptionsFilter` and its `ErrorResponseBody` with `requestId` (`common/filters/all-exceptions.filter.ts:11–18`); `nestjs-pino` request logging; the Swagger document with all seventeen tags (`main.ts:42–71`); the env validation class (`config/env.validation.ts`); the account-lockout policy (`auth.service.ts:7–8`, five attempts / fifteen minutes); every existing table, relation, foreign key, `onDelete` rule, and all six applied migrations.

**Not in scope:** any new column, enum value, relation, or constraint; any change to a response DTO or the `meta` envelope; any new permission key; any new endpoint; sorting on the communication timeline or on the unpaginated child lists (notes, comments, attachments, history, interactions); CI/CD; rate limiting; any new npm dependency.

---

## Context — Read These Files First

1. `apps/api/src/common/dto/pagination.dto.ts` — the **whole file, 34 lines.** `DEFAULT_PAGE_SIZE = 20` and `MAX_PAGE_SIZE = 100` at 4–5; `PaginationQueryDto` at 7–20; `PaginationMetaDto` at 22–34. The new `SortOrder` enum goes in this file. **`PaginationMetaDto` does not change** — Story 26 reads `meta` and must not need a new field.
2. `apps/api/src/customers/customers.service.ts` — `list()` at **lines 57–107**. The `where` construction is 58–84; the `$transaction` is 86–95; the hard-coded `orderBy: [{ name: 'asc' }, { createdAt: 'desc' }]` is **line 90**; the `meta` block is 99–104. That `orderBy` array is the *fallback* the new code must reproduce exactly when no `sort` is supplied.
3. `apps/api/src/tickets/tickets.service.ts` — `list()` at **lines 53–100**. `TICKET_SELECT` ends at 43. The scope handling is 66–77 — read the `where.AND` comment at **72–75**, which explains why `where.OR` must not be assigned over. The single-key `orderBy: { createdAt: 'desc' }` is **line 84**; this is the row that needs the tie-breaker most.
4. `apps/api/src/users/users.service.ts` — `list()` at **lines 54–101**. `orderBy: [{ fullName: 'asc' }, { email: 'asc' }]` is **line 85**. Note `where.isActive = query.isActive === 'true'` at 79 — `isActive` arrives as a **string** (`@IsBooleanString()`), the pattern to match if you add anything boolean-shaped.
5. `apps/api/src/tasks/agent-tasks.service.ts` — `list()` starts at **line 55**; the permission gates for `assigneeId`/`scope` are 62–75; the filters 77–88; `orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }]` is **line 93**. `dueAt` is **nullable** — see Product rule 5.
6. `apps/api/src/tickets/dto/list-tickets-query.dto.ts` — the **whole file, 56 lines.** The `TicketScope` enum at **8–13** with its doc comment at 6–7 is the exact shape and commenting style each new sort enum must follow. Every field is `@ApiPropertyOptional()` + `@IsOptional()` + `@IsEnum()`.
7. `apps/api/src/customers/dto/list-customers-query.dto.ts` (33 lines), `apps/api/src/users/dto/list-users-query.dto.ts` (32 lines), and `apps/api/src/tasks/dto/list-agent-tasks-query.dto.ts` (60 lines) — the other three query DTOs. All four extend `PaginationQueryDto`.
8. `apps/api/prisma/schema.prisma` — the four models this story indexes. `User` **138–177** (indexes at 174–176: `departmentId`, `branchId`, `isActive` — **no `fullName`**); `Customer` **255–286** (indexes at 283–285: `status`, `assignedAgentId`, `name`); `Ticket` **367–395** (indexes at 390–394: `status`, `priority`, `category`, `assignedAgentId`, `customerId` — **no `createdAt`, no `updatedAt`**); `AgentTask` **463–487** (indexes at 483–486). Note `AgentTask.dueAt` at 467 and `User.lastLoginAt` at 147 are both `DateTime?`.
9. `apps/api/prisma/seed.ts` — the **whole file, 345 lines.** `hashPassword` at **26–38**, with the load-bearing comment at 20–25: **the digest format must stay byte-compatible with `PasswordService.verify`** — reuse this function, do not write a second one. The `roles` array at **73–177** already contains `system-administrator` (76–80), `support-agent` (**126–146**), and `customer` (**147–152**, deliberately zero permissions). `seedBootstrapAdmin()` at **216–256** — copy its "never overwrite an existing password" shape (the `existing` check at 222–226) and its `userRole.upsert` at 250–255. `main()` at 258–336, with `await seedBootstrapAdmin()` at **319** and the summary counts at 321–334.
10. `apps/api/.env.example` — the **whole file.** The `# --- Bootstrap admin (seed only) ---` block carries the comment "*Consumed by prisma/seed.ts, NOT by the API at runtime, which is why these are absent from EnvironmentVariables*". The two new variables belong in that same block and follow the same rule: **they are seed-only and must NOT be added to `config/env.validation.ts`.**
11. `apps/api/src/customers/customers.service.spec.ts` — the `describe('list')` block at **lines 110–174**. Five tests, each asserting the exact object handed to `prisma.customer.findMany`. `'builds an empty where and passes skip: 0, take: 20 with no filters'` at 111 is the test that pins the fallback ordering.
12. `apps/api/test/tickets.e2e-spec.ts` lines **1–45** — the e2e harness: `ADMIN_EMAIL`/`ADMIN_PASSWORD` from env at 12–13, `FIXTURE_PASSWORD` at 14, `login()` at 24–28, `createUser()` at 30–45. New e2e assertions follow this shape.
13. Grep for `orderBy` in `apps/api/src/` before you start. There are **twenty-five** hits; only the **four** named in tasks 3 are in scope. The dashboard's five (`dashboard.service.ts:102–127`) and every child-list ordering stay exactly as they are.
14. [`.squad/plans/ticket-management/14-story-ticket-api-4.md`](../ticket-management/14-story-ticket-api-4.md) — the precedent for adding query parameters to a list endpoint in this codebase, including the Swagger and spec conventions.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **Sorting is opt-in and strictly additive.** With no `sort` in the query string, each of the four services issues the *identical* `orderBy` it issues today, plus the tie-breaker from rule 4. | The acceptance criteria require existing APIs to stay compatible with the current frontend. `apps/web` sends no `sort` today and Story 26 is a separate commit, so between the two the API must behave exactly as before. The five `describe('list')` tests in `customers.service.spec.ts:110–174` are the enforcement. |
| 2 | **Sortable columns are a per-resource `enum`, validated with `@IsEnum`. Never a free-form string.** | `main.ts:29–30` sets `forbidNonWhitelisted: true`, so an undeclared parameter already 400s — but a *declared* free-form string reaching `prisma.orderBy` would let a caller order by `passwordHash` or `failedLoginAttempts` and read information out of the row ordering. A closed enum makes the whitelist the type. |
| 3 | **No shared generic sort helper. Four private static maps, one per service,** each a `Record<SortField, (direction: Prisma.SortOrder) => Prisma.XOrderByWithRelationInput[]>` typed against that model's own Prisma input type. | A generic `buildOrderBy` cannot be typed against four different `OrderByWithRelationInput` types without a cast, and a cast in the one place that builds a database query is exactly where a whitelist stops being a whitelist. Four twelve-line maps the compiler checks beat one clever helper it cannot. |
| 4 | **Every resolved `orderBy` array ends with `{ id: 'asc' }`.** | `id` is the primary key on all four models, so appending it makes the total order unique. Without it, `tickets.service.ts:84`'s single-key `createdAt: 'desc'` is a genuine pagination bug, not a theoretical one: `skip`/`take` over a non-deterministic order can return one row on two pages and never return another. This is a **behaviour fix**, and the only one in this story. |
| 5 | **A sort on a nullable column declares `nulls: 'last'` in both directions.** Affects `AgentTask.dueAt`, `User.lastLoginAt`, `Customer.city`, `Customer.email`. | Postgres defaults to NULLs last for `ASC` and NULLs **first** for `DESC`. So "sort by due date, newest first" would open with every task that has no due date at all. `nulls` on `orderBy` is GA in the pinned Prisma 6.2, so this costs one property, not a raw query. |
| 6 | **The response envelope does not change.** `PaginationMetaDto` gains no field; the request's `sort`/`order` are not echoed back. | The frontend owns its own sort state — it just sent the values. Echoing them would add a field to a DTO that `apps/web` mirrors by hand in four places, for no reader. |
| 7 | **Indexes only. No column, type, relation, constraint, or `onDelete` change.** One migration, containing nothing but `CREATE INDEX`. | The acceptance criteria say "no unnecessary database changes are introduced". A migration that can only add indexes is one whose rollback is trivial and whose half-applied state is harmless. |
| 8 | **Dev test users are seeded only when `SEED_DEV_USERS=true` AND `NODE_ENV !== 'production'`. With `NODE_ENV=production` and the flag on, the seed throws before writing anything.** | "This functionality is intended for local/development/testing environments only." A flag alone is one typo in a deploy pipeline away from three known-password accounts in production. Failing loudly on the contradiction is the only version of this that cannot go wrong quietly. |
| 9 | **The dev password comes from `SEED_DEV_USER_PASSWORD`, and the seed refuses to run without it.** There is no default password value anywhere in the repository. | A default is a published credential the moment the repo is handed over. Requiring the operator to set it means the accounts cannot exist unless somebody chose the password. |
| 10 | **Dev test users get `mustChangePassword: false`,** unlike the bootstrap admin. | `AppLayout.vue:171–182` renders a warning banner whenever `mustChangePassword` is set, and Story 07 never shipped the change-password screen (see the comment at `AppLayout.vue:169–170`). Every test login would open on that banner — noise in exactly the workflow these accounts exist to speed up. |
| 11 | **Re-running the seed never overwrites an existing user's password**, dev accounts included. | `seedBootstrapAdmin()` (`seed.ts:222–226`) already made this decision, with the comment explaining it. Two different answers to "does the seed reset passwords?" in one file is how somebody loses an account. |
| 12 | `SEED_DEV_USERS` and `SEED_DEV_USER_PASSWORD` go in `.env.example` **but not in `EnvironmentVariables`**. | They are read by `prisma/seed.ts` under `ts-node`, outside the Nest container — exactly like `BOOTSTRAP_ADMIN_PASSWORD`. Adding them to `env.validation.ts` would imply the API reads them at runtime, which it must never do. |

---

## Backend Tasks

### 1 — The shared `SortOrder` enum

**File: `apps/api/src/common/dto/pagination.dto.ts`**

Add after the `MAX_PAGE_SIZE` constant (line 5), above `PaginationQueryDto`. Do **not** add `sort` or `order` to `PaginationQueryDto` itself — the default column and default direction differ per resource, so each resource DTO declares its own pair.

```ts
/** Sort direction, shared by every list endpoint. Deliberately NOT a field on
 *  PaginationQueryDto: each resource has its own default column and its own
 *  default direction, so the pair lives on the resource query DTO. */
export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}
```

### 2 — Four sort-field enums and eight new query fields

Each of the four DTOs gains an enum and two optional fields. Neither field carries a default — `undefined` is what selects the legacy fallback ordering (Product rule 1).

**File: `apps/api/src/customers/dto/list-customers-query.dto.ts`**

```ts
/** Columns the customer list may be ordered by. A closed enum, not a string:
 *  Story 25 Product rule 2. Absent = the legacy [name asc, createdAt desc]. */
export enum CustomerSortField {
  Name = 'name',
  Type = 'type',
  Email = 'email',
  City = 'city',
  Status = 'status',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}
```

Appended to the class:

```ts
  @ApiPropertyOptional({ enum: CustomerSortField, description: 'Omit for the default name-ascending order.' })
  @IsOptional()
  @IsEnum(CustomerSortField)
  sort?: CustomerSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Asc })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
```

**File: `apps/api/src/tickets/dto/list-tickets-query.dto.ts`** — the same two fields (with `default: SortOrder.Desc` in the `@ApiPropertyOptional`, matching this list's legacy direction), plus:

```ts
export enum TicketSortField {
  Subject = 'subject',
  Category = 'category',
  Priority = 'priority',
  Status = 'status',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}
```

**File: `apps/api/src/users/dto/list-users-query.dto.ts`** — the same two fields, plus:

```ts
export enum UserSortField {
  FullName = 'fullName',
  Email = 'email',
  IsActive = 'isActive',
  LastLoginAt = 'lastLoginAt',
  CreatedAt = 'createdAt',
}
```

**File: `apps/api/src/tasks/dto/list-agent-tasks-query.dto.ts`** — the same two fields, plus:

```ts
export enum AgentTaskSortField {
  Title = 'title',
  Status = 'status',
  DueAt = 'dueAt',
  CreatedAt = 'createdAt',
}
```

Each file needs `SortOrder` added to its existing `import { PaginationQueryDto } from '../../common/dto/pagination.dto';` line.

### 3 — The four resolvers

One private static map, one fallback array, and one private static method per service. Add each **immediately above** the `list()` method it serves.

**File: `apps/api/src/customers/customers.service.ts`** — above `list()` (line 57):

```ts
  /** Whitelisted orderings for the customer list. Product rule 3: typed against
   *  Prisma's own input type, so a column that does not exist is a compile error. */
  private static readonly SORT_COLUMNS: Record<
    CustomerSortField,
    (direction: Prisma.SortOrder) => Prisma.CustomerOrderByWithRelationInput[]
  > = {
    [CustomerSortField.Name]: (direction) => [{ name: direction }],
    [CustomerSortField.Type]: (direction) => [{ type: direction }],
    // Nullable columns pin NULLs last in BOTH directions — Product rule 5.
    [CustomerSortField.Email]: (direction) => [{ email: { sort: direction, nulls: 'last' } }],
    [CustomerSortField.City]: (direction) => [{ city: { sort: direction, nulls: 'last' } }],
    [CustomerSortField.Status]: (direction) => [{ status: direction }],
    [CustomerSortField.CreatedAt]: (direction) => [{ createdAt: direction }],
    [CustomerSortField.UpdatedAt]: (direction) => [{ updatedAt: direction }],
  };

  /** The pre-Story-25 ordering, reproduced exactly when no sort is requested. */
  private static readonly SORT_FALLBACK: Prisma.CustomerOrderByWithRelationInput[] = [
    { name: 'asc' },
    { createdAt: 'desc' },
  ];

  private static resolveOrderBy(
    query: ListCustomersQueryDto,
  ): Prisma.CustomerOrderByWithRelationInput[] {
    const columns = query.sort
      ? CustomersService.SORT_COLUMNS[query.sort](query.order ?? 'asc')
      : CustomersService.SORT_FALLBACK;

    // Product rule 4: a unique trailing key, so skip/take is deterministic.
    return [...columns, { id: 'asc' }];
  }
```

Then replace **line 90** — `orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],` — with:

```ts
        orderBy: CustomersService.resolveOrderBy(query),
```

**File: `apps/api/src/tickets/tickets.service.ts`** — the same three members against `Prisma.TicketOrderByWithRelationInput`, with `SORT_FALLBACK = [{ createdAt: 'desc' }]` and **`query.order ?? 'desc'`** — this is the one resolver whose default direction is descending, because its legacy ordering is. Replace **line 84**.

**File: `apps/api/src/users/users.service.ts`** — `Prisma.UserOrderByWithRelationInput`, `SORT_FALLBACK = [{ fullName: 'asc' }, { email: 'asc' }]`, `query.order ?? 'asc'`; `lastLoginAt` declares `nulls: 'last'`. Replace **line 85**.

**File: `apps/api/src/tasks/agent-tasks.service.ts`** — `Prisma.AgentTaskOrderByWithRelationInput`, `SORT_FALLBACK = [{ dueAt: 'asc' }, { createdAt: 'desc' }]`, `query.order ?? 'asc'`; `dueAt` declares `nulls: 'last'`. Replace **line 93**.

Note that the fallback arrays also gain the trailing `{ id: 'asc' }`, because it is appended inside `resolveOrderBy` on both branches. That is the tie-breaker fix, and it is why the existing spec assertions on `findMany` must be **updated to include the new trailing key** — update, do not weaken, and do not delete.

### 4 — The index migration

**File: `apps/api/prisma/schema.prisma`** — add these `@@index` lines only, each beside the model's existing index block.

- `User`, before `@@map("users")` at line 177: `@@index([fullName])`, `@@index([lastLoginAt])`
- `Customer`, before `@@map("customers")` at 286: `@@index([createdAt])`, `@@index([updatedAt])`
- `Ticket`, before `@@map("tickets")` at 395: `@@index([createdAt])`, `@@index([updatedAt])`
- `AgentTask`, before `@@map("agent_tasks")` at 487: `@@index([createdAt])`

`User.fullName` and `Ticket.createdAt` back the **default** ordering of two lists that have been paginating without them since Stories 07 and 14 — those two are the fix. The other five back newly sortable columns.

**Accepted without an index, on purpose:** `Ticket.subject`, `AgentTask.title`, `Customer.email`, `Customer.city` (`Customer.email` is `@unique`, so already indexed; `User.email` likewise), and every enum column on `Ticket`/`Customer`, which is already indexed. A text column that is sortable but rarely sorted does not earn a btree at this data volume. Record the omission in a comment beside the new indexes rather than silently indexing everything.

Generate the migration from `apps/api`:

```bash
npm run prisma:migrate -- --name list_sort_indexes
npm run prisma:generate
```

Then **read the generated SQL** at `apps/api/prisma/migrations/<timestamp>_list_sort_indexes/migration.sql` and confirm every statement is `CREATE INDEX`. If it contains anything else, the schema edit went wrong — revert and redo.

### 5 — Dev test users in the seed

**File: `apps/api/prisma/seed.ts`**

Add the persona table beside the other seed-data constants, after the `quickReplies` array (which ends at line 214):

```ts
/** Development/testing accounts, one per persona, seeded only behind
 *  SEED_DEV_USERS — Story 25 Product rules 8–11. Story 28's login picker reads
 *  the same three emails from its own frontend-side list; keep them in step.
 *  Passwords are never stored here: SEED_DEV_USER_PASSWORD supplies one. */
const devTestUsers: { email: string; fullName: string; roleKey: string }[] = [
  { email: 'dev.admin@crm.local', fullName: 'Dev System Administrator', roleKey: 'system-administrator' },
  { email: 'dev.agent@crm.local', fullName: 'Dev Support Agent', roleKey: 'support-agent' },
  { email: 'dev.customer@crm.local', fullName: 'Dev Customer', roleKey: 'customer' },
];
```

Then the seeding function, beside `seedBootstrapAdmin()`:

```ts
async function seedDevTestUsers(): Promise<void> {
  if (process.env.SEED_DEV_USERS !== 'true') {
    return;
  }

  // Product rule 8: the flag and a production NODE_ENV are a contradiction, and
  // the safe reading of a contradiction is to refuse, not to guess.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SEED_DEV_USERS=true is refused with NODE_ENV=production. These accounts have known passwords.',
    );
  }

  // Product rule 9: no default. An account whose password ships in the
  // repository is worse than no account.
  const password = process.env.SEED_DEV_USER_PASSWORD;

  if (!password) {
    throw new Error('SEED_DEV_USERS=true requires SEED_DEV_USER_PASSWORD to be set.');
  }

  for (const persona of devTestUsers) {
    const email = persona.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Product rule 11 — the same decision seedBootstrapAdmin made at line 224.
      console.log(`Dev test user ${email} already exists; password left unchanged.`);
    } else {
      await prisma.user.create({
        data: {
          email,
          fullName: persona.fullName,
          passwordHash: await hashPassword(password),
          // Product rule 10: the mustChangePassword banner would open every one
          // of these sessions, and there is no screen to resolve it.
          mustChangePassword: false,
        },
      });
      console.log(`Dev test user created: ${email} (${persona.roleKey})`);
    }

    const role = await prisma.role.findUniqueOrThrow({ where: { key: persona.roleKey } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
}
```

Call it in `main()` on the line **after** `await seedBootstrapAdmin();` (line 319). It must run after the `roles` loop (298–317), because `findUniqueOrThrow` on `role` depends on those upserts.

Reuse the existing `hashPassword` at 26–38 — do **not** write a second hasher. Its comment at 20–25 says the digest format must stay byte-compatible with `PasswordService.verify`, and that is precisely what lets these accounts sign in through the real `POST /api/auth/login`.

Optionally extend the summary log at 321–334 with the dev-user count; keep the existing counts intact.

### 6 — Environment documentation

**File: `apps/api/.env.example`** — append after the existing `# --- Bootstrap admin (seed only) ---` block:

```
# --- Dev test users (seed only, Story 25) ---
# Seeds one account per persona (system-administrator, support-agent, customer)
# for Story 28's login test-user picker. Read by prisma/seed.ts ONLY — these are
# deliberately absent from EnvironmentVariables in src/config/env.validation.ts.
# The seed THROWS if this is true while NODE_ENV=production.
SEED_DEV_USERS=true
# Required whenever SEED_DEV_USERS=true. There is no default: an account whose
# password ships in the repository is worse than no account.
SEED_DEV_USER_PASSWORD=ChangeMe_Dev_Only_1
```

---

## Edge Cases & Failure Modes

- **`?sort=passwordHash`** → `@IsEnum(UserSortField)` rejects with 400 before the service runs (`users/dto/list-users-query.dto.ts`). No column outside the four enums is reachable.
- **`?sort=name&order=sideways`** → `@IsEnum(SortOrder)` rejects with 400. Enforced in each query DTO.
- **`?order=desc` with no `sort`** → `query.sort` is `undefined`, so `resolveOrderBy` takes the fallback branch and `order` is ignored entirely. A direction with nothing to direct is not an error; it is the legacy ordering. Assert this explicitly in each service spec.
- **`?sortBy=name`** (wrong parameter name) → `forbidNonWhitelisted: true` (`main.ts:30`) returns 400 with `property sortBy should not exist`. Story 26 must send `sort`, not `sortBy`.
- **Two rows with an identical `createdAt`, paginated** → the trailing `{ id: 'asc' }` from `resolveOrderBy` gives them a stable relative order, so neither is duplicated across pages nor skipped. This is the behaviour that was broken at `tickets.service.ts:84`.
- **Sorting tasks by `dueAt` descending** → tasks with `dueAt: null` sort **last**, not first, because of `nulls: 'last'` (Product rule 5). Same for `User.lastLoginAt` (a user who never signed in), `Customer.email`, `Customer.city`.
- **Sorting the ticket list with `scope=mine` and a search term** → ordering is orthogonal to `where`; the `where.AND` composition at `tickets.service.ts:72–77` is untouched. Add a spec case that sends `scope`, `search`, and `sort` together and asserts both the `where` and the `orderBy`.
- **Sorting the task list while `overdueOnly=true`** → `agent-tasks.service.ts:85–88` overwrites `where.dueAt` and `where.status`; sorting by `dueAt` on top of that filter is valid and must not change the filter. Assert both in one case.
- **`npm run prisma:seed` twice with `SEED_DEV_USERS=true`** → the second run logs "already exists; password left unchanged" three times and re-upserts the role assignments. No password rewritten, no duplicate row, no error.
- **`SEED_DEV_USERS=true` with `SEED_DEV_USER_PASSWORD` unset** → the seed throws with a named message *before* creating any user. Because the throw happens inside `main()`, the `.catch` at line 337 sets `process.exitCode = 1` — the seed fails visibly rather than half-applying.
- **`SEED_DEV_USERS=true` with `NODE_ENV=production`** → throws the refusal message before any write. This is the guard that matters most; give it its own test.
- **A dev persona email already belongs to a real user** → the account is left completely alone (no password change, no name change) but the persona's role **is** upserted onto it. That is a deliberate privilege-escalation risk if somebody names a production user `dev.admin@crm.local`, and it is why the production guard is a hard throw rather than a warning. Note it beside the constant and in the README section Story 29 writes.
- **Half-applied migration** → the migration contains only `CREATE INDEX` statements, each independently committed. A failure part-way leaves some indexes created; re-running `prisma migrate deploy` completes the rest. No data is at risk and no application code depends on an index existing.

---

## Test Plan

1. **Unit — `apps/api/src/customers/customers.service.spec.ts`.** In the existing `describe('list')` block (110–174), update the five current assertions so the expected `orderBy` is `[{ name: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }]`. Add: `'orders by the requested column and direction when sort is supplied'`; `'ignores order when sort is absent'`; `'pins NULLs last when sorting by the nullable city column'`; `'always appends { id: "asc" } as the tie-breaker'`.
2. **Unit — `apps/api/src/tickets/tickets.service.spec.ts`.** The same four additions against `TicketSortField`, plus `'defaults to descending when order is omitted'` (the one resolver whose default direction is `desc`), plus `'composes sort with scope=mine and a search term without disturbing where.AND'`.
3. **Unit — `apps/api/src/users/users.service.spec.ts`.** The same shape against `UserSortField`; include the `lastLoginAt` nulls-last case.
4. **Unit — `apps/api/src/tasks/agent-tasks.service.spec.ts`.** The same shape against `AgentTaskSortField`; include the `dueAt` nulls-last case in **both** directions, since that column's legacy ordering is ascending, and one case combining `overdueOnly` with a sort.
5. **E2E — `apps/api/test/tickets.e2e-spec.ts`.** Add `describe('list sorting')`: create three tickets with distinct subjects; assert `GET /api/tickets?sort=subject&order=asc` returns ascending subject order; assert `?sort=nope` returns **400**; assert `?sortBy=createdAt` returns **400** (the `forbidNonWhitelisted` path); assert a request with no `sort` returns the same first item as before the change.
6. **E2E — `apps/api/test/customers.e2e-spec.ts`.** One case: `?sort=createdAt&order=desc` puts the most recently created fixture customer first.
7. **Unit — new `apps/api/prisma/seed.spec.ts` is NOT wanted.** `prisma/` is outside the jest `rootDir` (`package.json` sets `"rootDir": "src"`). Instead cover the guards in **`apps/api/test/seed.e2e-spec.ts`**: read that file first for its existing seeded-row assertions, then add a case asserting that with `SEED_DEV_USERS` unset no `dev.*@crm.local` user exists. **Do not** seed the dev users into the shared e2e database.
8. **Schema — `apps/api/test/tickets-schema.e2e-spec.ts`.** Read it for its existing index-inspection pattern, then assert `tickets` has indexes on `created_at` and `updated_at`. Add the matching `users(full_name)` assertion to `apps/api/test/users.e2e-spec.ts` or whichever schema spec already inspects `pg_indexes` — match the established pattern rather than inventing a new one.
9. **No frontend test changes.** `apps/web` is untouched; all 523 web tests must still pass unmodified.

---

## Migration / Rollback

- **Forward:** from `apps/api`, `npm run prisma:migrate -- --name list_sort_indexes`, then `npm run prisma:generate`. `npm run prisma:seed` is not required by the schema change, but **is** required to create the dev test users Story 28 needs.
- **Rollback:** the migration only creates indexes. To reverse, `DROP INDEX` each one; no data is lost and no application code fails without them — the queries plan a sort instead of an index scan. Reverting the TypeScript changes alone is also safe: the indexes become unused, not wrong.
- **Half-applied state:** harmless. Indexes are independent; `prisma migrate deploy` is idempotent from any partial state.
- **The dev-user seed is not a migration** and creates no schema. To reverse it, delete the three `dev.*@crm.local` users; their `user_roles` rows cascade.

---

## Verification Steps

1. **Backend builds:** from the repo root, `npm run build --workspace @crm/api`. Must exit 0.
2. **Type checking passes:** from the repo root, `npm run typecheck`. Must exit 0 for both workspaces.
3. **Backend unit tests:** `npm run test --workspace @crm/api`. Must report **at least** the 406 tests that passed before, all green, plus the new cases.
4. **Backend e2e:** from `apps/api`, `npm run test:e2e`. Requires PostgreSQL and a seeded database.
5. **Lint:** `npm run lint --workspace @crm/api`.
6. **Migration is indexes-only:** `git diff --stat apps/api/prisma/`, then read the generated `migration.sql` end to end and confirm every statement is `CREATE INDEX`.
7. **Regression — the frontend is untouched:** `git diff --name-only` must list **no** path beginning `apps/web/`, and `npm run test --workspace @crm/web` must report 523 passing with no file modified.
8. **Regression — legacy list behaviour:** with both dev servers running (`npm run dev:api`, `npm run dev:web` from the repo root), open `/customers`, `/tickets`, `/users`, `/tasks`. Every list loads exactly as before, and no request in the network tab carries a `sort` parameter.
9. **Sorting works over HTTP:** through Swagger at `http://localhost:3000/api/docs`, `GET /api/tickets?sort=priority&order=desc` with a bearer token. Confirm 200 and the ordering. Confirm `?sort=bogus` returns 400.
10. **Dev seed guard:** from `apps/api`, run the seed with `NODE_ENV=production SEED_DEV_USERS=true SEED_DEV_USER_PASSWORD=x` and confirm it **fails** with the refusal message and creates nothing. Then run with `SEED_DEV_USERS=true` and no password and confirm it fails too.
11. **Dev seed works:** set `SEED_DEV_USERS=true` and `SEED_DEV_USER_PASSWORD` in `apps/api/.env`, run `npm run prisma:seed`, confirm three accounts are created. Sign in as each through the real login form and confirm the sidebar matches the role: the administrator sees every group; `dev.agent@crm.local` sees Work and Records but **not** Users; `dev.customer@crm.local` sees only Dashboard and System Status, because the `customer` role holds zero permissions (`seed.ts:147–152`).
12. **Seed is idempotent:** run `npm run prisma:seed` again. Three "already exists; password left unchanged" lines, no error, no new rows.

---

## Done Criteria

- [ ] `SortOrder` is exported from `apps/api/src/common/dto/pagination.dto.ts`; `PaginationQueryDto` and `PaginationMetaDto` are otherwise unchanged.
- [ ] `CustomerSortField`, `TicketSortField`, `UserSortField`, and `AgentTaskSortField` exist, each with an `@IsEnum`-validated `sort` and `order` pair on its query DTO, documented with `@ApiPropertyOptional`.
- [ ] All four list services resolve `orderBy` through a private static, compile-time-checked column map; no cast and no free-form string reaches Prisma.
- [ ] A request with no `sort` produces the pre-existing ordering plus the tie-breaker, and every previously passing service spec still passes with its expectation **updated** — not weakened — to include `{ id: 'asc' }`.
- [ ] Every resolved ordering ends in `{ id: 'asc' }`; sorting on `dueAt`, `lastLoginAt`, `city`, or `email` places NULLs last in both directions.
- [ ] One migration exists, it contains only `CREATE INDEX` statements, and it adds the seven indexes named in task 4.
- [ ] `prisma/seed.ts` seeds three persona accounts behind `SEED_DEV_USERS=true`, throws with `NODE_ENV=production`, throws without `SEED_DEV_USER_PASSWORD`, sets `mustChangePassword: false`, never overwrites an existing password, and reuses the existing `hashPassword`.
- [ ] `SEED_DEV_USERS` and `SEED_DEV_USER_PASSWORD` are documented in `apps/api/.env.example` and appear **nowhere** in `src/config/env.validation.ts`.
- [ ] No file under `apps/web/` is modified; all 523 web tests pass untouched.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, and both test suites pass from the repo root.
- [ ] All three seeded personas sign in through the existing `POST /api/auth/login` and land on a UI whose navigation matches their permissions.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 26.**
