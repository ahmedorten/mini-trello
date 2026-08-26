# Story 18 — Agent dashboard API, workable-ticket scope, and permissioned reassignment (Story: 5)

## Prerequisites

- [Story 17 completed](17-story-agent-workspace-data-model-5.md): the migration is applied, `prisma:generate` has run, and the seven new permission keys are seeded. This story calls `prisma.agentTask` and reads `tickets:assign` and `dashboard:read` — none of that exists before Story 17.
- PostgreSQL running; `npm run dev:api` starts cleanly.
- **No frontend change is permitted in this story.** Stories 20–21 own `apps/web/`.
- **No migration is permitted in this story.** Story 17 owns the schema.

---

## Story Goal

1. A new **dashboard module** exposing `GET /api/dashboard/agent` — the single call Story 21's dashboard renders from. It returns ticket counts (assigned, open, pending, overdue, unassigned), status/priority/category breakdowns, a short list of the caller's most pressing tickets, a short list of overdue tickets, and a short list of tasks due soon.
2. **Overdue as a derived value.** One exported constant table maps `TicketPriority` to an age threshold in hours; a ticket in an active status whose `updatedAt` is older than its threshold is overdue. No schema field, no configuration surface.
3. A **`scope` filter** on the existing `GET /api/tickets` list — `mine`, `unassigned`, `workable`, `all` — so the workspace queue can ask for "assigned to or workable by me" without a second endpoint.
4. **Permissioned reassignment.** A new `PATCH /api/tickets/:id/assignment` route, and the same rule enforced inside the existing `create()` and `update()` paths so it cannot be bypassed: without `tickets:assign`, a caller may only claim a ticket for themselves or release one already assigned to them.

**Not in scope:** agent tasks CRUD and quick-replies CRUD (Story 19), the interaction timeline (Story 19), any frontend file (Stories 20–21), caching or materialised views, SLA configuration, notifications or scheduled jobs.

---

## Context — Read These Files First

1. `apps/api/src/tickets/tickets.service.ts` — full file (300 lines). This is both the model to copy and the file you modify:
   - `TICKET_MANAGE_PERMISSION` (line 11), `CUSTOMER_REF_SELECT` (13–17), `TICKET_SELECT` (20–33), and `SelectedTicket` (35) — the dashboard reuses `TICKET_SELECT` verbatim for its embedded ticket lists.
   - `list()` (43–79) — the `where`-building block (44–57) is what gains the `scope` branch, and the `$transaction([findMany, count])` pair (59–68) is the pattern the dashboard's aggregate query follows.
   - `update()` (113–192) — read the comment at **127–132** carefully. `dto.assignedAgentId !== undefined` is the presence test, **not** `'assignedAgentId' in dto`; the new assignment guard must use the same test or it will fire on every PATCH.
   - `setStatus()` (194–236) — the "history insert must run **before** the update-with-select, because `_count.history` is computed by that select" ordering comment at 208–209. `assign()` must follow the same ordering.
   - `assertExists()` (238–248), `assertCustomerExists()` (250–259), `assertAgentExists()` (261–278) — reuse all three; `assign()` needs the last one.
   - `toResponse()` (280–299).
2. `apps/api/src/tickets/tickets.controller.ts` — full file (91 lines). The decorator stack on every route (`@RequirePermissions`, `@ApiOperation`, `@ApiOkResponse`, `@CurrentUser()`, `@Param('id', ParseUUIDPipe)`) is the exact shape the new `assignment` route uses. `setStatus` at **80–90** is its nearest sibling: same `Patch(':id/...')` shape, same `tickets:write` gate.
3. `apps/api/src/tickets/dto/list-tickets-query.dto.ts` — full file (37 lines). Extends `PaginationQueryDto`; each filter is `@IsOptional()` plus a type validator. The new `scope` param goes here. **The global pipe runs with `forbidNonWhitelisted: true`** (`apps/api/src/main.ts` lines 27–34), so an unlisted key is an instant `400` — this is why the param must be declared, not read off the raw query.
4. `apps/api/src/tickets/dto/set-ticket-status.dto.ts` — 9 lines. The template for `AssignTicketDto`: one field, one `@ApiProperty`, one validator.
5. `apps/api/src/customers/customers.service.ts` lines **1–48** — `ARCHIVE_PERMISSION` (19), `USER_REF_SELECT` (21–25, exported and reused across three modules already), and the `CUSTOMER_SELECT` doc comment at 26–27 ("The ONLY projection used…, so a column added to the model later cannot leak"). The dashboard DTOs follow that rule.
6. `apps/api/src/org/org.module.ts` and `apps/api/src/org/org.controller.ts` lines 1–50 — the smallest complete module in the repo, and the template for the new `DashboardModule`: `imports: [AuthModule]`, one controller, one service.
7. `apps/api/src/app.module.ts` lines **6–13** and **54–61** — the import list and the `imports:` array. `DashboardModule` is registered here, after `TicketsModule` and before `HealthModule`.
8. `apps/api/src/main.ts` lines **42–58** — the `DocumentBuilder` tag list. Add `.addTag('dashboard', ...)`.
9. `apps/api/src/auth/types/authenticated-user.ts` — 14 lines. `permissions: string[]` is what the guard populates and what `caller.permissions.includes(...)` reads; `id` is the caller's user id, used for every `mine`/`assignee` predicate in this story.
10. `apps/api/src/auth/guards/permissions.guard.ts` lines **73–99** — `@RequirePermissions()` requires **all** listed keys, and the guard throws `ForbiddenException('Missing permission: …')`. Relevant because `dashboard:read` is a single key, not an "any-of" set.
11. `apps/api/test/tickets.e2e-spec.ts` — read lines **1–70** (harness: `login`, `createUser`, `createTicket`, the `beforeAll` that mirrors `main.ts`'s pipe/filter/Swagger setup) and **323–352** (the `support-agent` describe block). Note that the existing test titled `'can update category/priority/assignedAgentId'` at **342–352** only sends `{ priority: 'HIGH' }` — so it survives the new assignment guard unchanged. Verify this yourself before touching `update()`.
12. [`.squad/plans/ticket-management/14-story-ticket-api-4.md`](../ticket-management/14-story-ticket-api-4.md) — the precedent for this story's shape: service-owns-the-projection, controller-owns-the-decorators, one DTO file per resource.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **"Overdue" is derived**, from one exported constant: `OVERDUE_AFTER_HOURS: Record<TicketPriority, number> = { URGENT: 4, HIGH: 8, MEDIUM: 24, LOW: 72 }`, measured from `updatedAt`, and only for a ticket whose status is in `ACTIVE_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']`. | Story 17 Product rule 3: no SLA field exists. Deriving from `updatedAt` (not `createdAt`) makes "overdue" mean "untouched too long", which is what an agent queue needs — a ticket worked on an hour ago is not overdue however old it is. `RESOLVED`/`CLOSED` are never overdue. |
| 2 | **"Pending" means `ON_HOLD`.** The dashboard's three headline indicators are `open` (`OPEN`), `pending` (`ON_HOLD`), and `overdue` (rule 1). `IN_PROGRESS` is counted separately in the status breakdown. | The intake names "open, pending, and overdue"; `ON_HOLD` is the only status that reads as pending. Inventing a fourth enum value would need a migration Story 17 already closed. |
| 3 | The four `scope` values are: **`mine`** = `assignedAgentId === caller.id`; **`unassigned`** = `assignedAgentId === null`; **`workable`** = either of those (`OR`); **`all`** = no assignment predicate. Default when the key is absent is **`all`**. | `all` as the default keeps `GET /api/tickets` byte-identical for every existing caller, including Story 16's list view and the e2e suite. `workable` is the one the workspace queue asks for and the one the acceptance criterion "assigned to or workable by the current user" names. |
| 4 | **`scope` is a filter, not a security boundary.** `tickets:read` still grants read access to every ticket; `scope=all` is available to any `tickets:read` holder and is not gated on `tickets:manage`. | Work item 4 deliberately made `tickets:read` flat ("One read key" in its overview). Turning it into row-level security now would be a breaking behaviour change to Story 14's contract and would regress Story 16's list view, which shows all tickets by design. The acceptance criterion is satisfied by the workspace *defaulting* to `workable` (Story 21), not by removing read access. Documented here so no later story re-litigates it. |
| 5 | Without **`tickets:assign`**, a caller holding `tickets:write` may set `assignedAgentId` **only** to their own `caller.id`, and may clear it (`null`) **only** when the ticket is currently assigned to them. Any other value is `403`. | This is the "reassignment according to permissions" requirement. Claim-and-release is the front-line agent's legitimate need; handing a ticket to a named colleague is a supervisor action. Seeded so that `support-agent` lacks the key and `support-supervisor`/`crm-manager` hold it (Story 17 task 8). |
| 6 | Rule 5 is enforced in **three** places: the new `assign()`, and the existing `create()` and `update()`. | A guard on only the new route is not a guard — `PATCH /api/tickets/:id` already accepts `assignedAgentId` and would be the bypass. This is a deliberate **behaviour change** to a Story-14 file; see Migration / Rollback. |
| 7 | `assign()` writes a `TicketHistory` row with `field: 'assignedAgentId'` — **the same field name** `update()` already uses. | Story 16's History tab maps `'assignedAgentId'` to the label "Assigned agent" and resolves the value against the loaded agent list. A new field name would render as an unmapped raw string. |
| 8 | The dashboard endpoint is gated on the single key **`dashboard:read`**, not on `tickets:read` + `tasks:read`. It degrades instead of failing: if the caller lacks `tasks:read`, `tasksDueSoon` comes back `[]` rather than `403`. | `@RequirePermissions()` requires *all* listed keys (guard lines 73–77), so listing three keys would lock out `reporting-user`, which holds only `dashboard:read`. Degrading matches how Story 16's store already swallows a missing-permission failure on `loadAgents()` into an empty picker. |
| 9 | Every embedded ticket list on the dashboard is **capped at 5** and the cap is an exported constant, not a literal. The response carries the full counts alongside, so the UI can say "5 of 23". | The dashboard must not become an unpaginated ticket list. The cap being a named constant is what makes the "no silent truncation" property checkable. |
| 10 | The dashboard computes overdue-ness in **SQL**, not by fetching every ticket and filtering in Node. | With one `OR` clause per priority (four terms) the predicate is index-assisted by `tickets_priority_idx` / `tickets_status_idx` and the row count never depends on table size. Fetching-then-filtering would grow unboundedly. |
| 11 | `scope=mine`/`workable` on `GET /api/tickets` requires the caller — so **`TicketsService.list()` gains a `caller: AuthenticatedUser` parameter** and the controller passes `@CurrentUser()`. | The service has no other way to know who is asking. This is an additive signature change; every existing call site is in `tickets.controller.ts` and `tickets.service.spec.ts`. |

---

## Backend Tasks

### 1 — Overdue constants

**Create file: `apps/api/src/tickets/ticket-insights.ts`**

A tiny module with no NestJS dependencies, so both `TicketsService` and `DashboardService` can import it without a circular module edge.

```ts
import { TicketPriority, TicketStatus } from '@prisma/client';

/** Statuses a ticket can be overdue in. RESOLVED and CLOSED never are. */
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.ON_HOLD,
];

/** "Pending" in the dashboard's headline indicators. */
export const PENDING_TICKET_STATUS = TicketStatus.ON_HOLD;

/**
 * How long a ticket of each priority may sit untouched before the dashboard
 * calls it overdue, measured from `updatedAt` (Product rule 1). Derived, not
 * stored: work item 4 deliberately shipped no SLA field, and this table is the
 * whole of the "overdue" definition. Change it here and every counter, badge,
 * and list in Stories 18 and 21 moves together.
 */
export const OVERDUE_AFTER_HOURS: Record<TicketPriority, number> = {
  [TicketPriority.URGENT]: 4,
  [TicketPriority.HIGH]: 8,
  [TicketPriority.MEDIUM]: 24,
  [TicketPriority.LOW]: 72,
};

/** Max rows in any embedded dashboard list (Product rule 9). */
export const DASHBOARD_LIST_LIMIT = 5;

/** The cutoff instant for each priority, given "now". */
export function overdueCutoffs(now: Date): { priority: TicketPriority; before: Date }[] {
  return (Object.keys(OVERDUE_AFTER_HOURS) as TicketPriority[]).map((priority) => ({
    priority,
    before: new Date(now.getTime() - OVERDUE_AFTER_HOURS[priority] * 60 * 60 * 1000),
  }));
}
```

`overdueCutoffs(now)` takes `now` as a **parameter** rather than calling `Date.now()` internally — that is what makes the unit tests deterministic.

### 2 — The `scope` filter on the ticket list

**File: `apps/api/src/tickets/dto/list-tickets-query.dto.ts`**

Add the type and the field:

```ts
/** Which assignment slice of the ticket table to return. A FILTER, not a
 *  security boundary — see Story 18 Product rule 4. */
export enum TicketScope {
  Mine = 'mine',
  Unassigned = 'unassigned',
  Workable = 'workable',
  All = 'all',
}
```

```ts
  @ApiPropertyOptional({
    enum: TicketScope,
    default: TicketScope.All,
    description:
      'mine = assigned to the caller; unassigned = no agent; workable = either; all = no filter.',
  })
  @IsOptional()
  @IsEnum(TicketScope)
  scope: TicketScope = TicketScope.All;
```

Give it an **initialiser** (like `page`/`pageSize` in `PaginationQueryDto` lines 149–162) so the service never has to `?? 'all'`.

**File: `apps/api/src/tickets/tickets.service.ts`**

Change the signature at line 43 to `async list(query: ListTicketsQueryDto, caller: AuthenticatedUser)` and add the scope branch to the `where`-building block (after the `customerId` line, 57):

```ts
    if (query.scope === TicketScope.Mine) {
      where.assignedAgentId = caller.id;
    } else if (query.scope === TicketScope.Unassigned) {
      where.assignedAgentId = null;
    } else if (query.scope === TicketScope.Workable) {
      // AND, not OR-into-`where.OR`: `where.OR` may already hold the search
      // clause (lines 46–51), and assigning over it would silently drop the
      // search term. `AND` composes with whatever is already there.
      where.AND = [{ OR: [{ assignedAgentId: caller.id }, { assignedAgentId: null }] }];
    }
```

That comment matters: `search` writes `where.OR` a few lines above, so `scope=workable&search=login` would lose the search if `where.OR` were overwritten. Reuse this exact composition in the dashboard.

**File: `apps/api/src/tickets/tickets.controller.ts`** — `list()` at 38–40 becomes:

```ts
  list(
    @Query() query: ListTicketsQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PaginatedTicketsDto> {
    return this.ticketsService.list(query, caller);
  }
```

`CurrentUser` and `AuthenticatedUser` are already imported (lines 13, 15).

### 3 — The assignment guard

**Create file: `apps/api/src/tickets/dto/assign-ticket.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * `assignedAgentId: null` releases the ticket. There is no "absent" case here,
 * unlike UpdateTicketDto: this route exists only to change the assignment, so
 * the key is always meaningful and `undefined` is rejected as a 400.
 */
export class AssignTicketDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId!: string | null;
}
```

**File: `apps/api/src/tickets/tickets.service.ts`**

Add the permission constant beside `TICKET_MANAGE_PERMISSION` (line 11):

```ts
export const TICKET_ASSIGN_PERMISSION = 'tickets:assign';
```

Add the private guard, next to `assertAgentExists` (261–278):

```ts
  /**
   * Product rule 5. Called from create(), update(), and assign() — all three,
   * or PATCH /tickets/:id becomes the bypass for the assignment route.
   *
   * `currentAssigneeId` is the ticket's assignment BEFORE this write; pass
   * `null` on create.
   */
  private assertMayAssign(
    nextAssigneeId: string | null,
    currentAssigneeId: string | null,
    caller: AuthenticatedUser,
  ): void {
    if (caller.permissions.includes(TICKET_ASSIGN_PERMISSION)) {
      return;
    }

    if (nextAssigneeId === caller.id) {
      return;
    }

    if (nextAssigneeId === null && currentAssigneeId === caller.id) {
      return;
    }

    throw new ForbiddenException(
      'You may only assign a ticket to yourself, or release one assigned to you.',
    );
  }
```

Import `ForbiddenException` from `@nestjs/common` (the import block at line 1 currently pulls `BadRequestException, Injectable, Logger, NotFoundException`).

Wire it into the three call sites:

- **`create()`** (91–111): after `assertAgentExists` (93), add
  ```ts
    if (dto.assignedAgentId !== undefined) {
      this.assertMayAssign(dto.assignedAgentId ?? null, null, caller);
    }
  ```
  Guarded on `!== undefined` so a create with **no** `assignedAgentId` is unaffected — that is what keeps `createTicket(agentToken)` in the existing e2e suite passing.
- **`update()`** (113–192): inside the existing `if (dto.assignedAgentId !== undefined)` block at 133–135, after `assertAgentExists`, add
  ```ts
      this.assertMayAssign(dto.assignedAgentId ?? null, current.assignedAgentId, caller);
  ```
  `current` already selects `assignedAgentId` (line 120), so no extra query.
- **`assign()`** — the new method below.

### 4 — `TicketsService.assign()`

**File: `apps/api/src/tickets/tickets.service.ts`**, after `setStatus()` (ends line 236).

```ts
  async assign(
    id: string,
    assignedAgentId: string | null,
    caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    const current = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, assignedAgentId: true },
    });

    if (!current) {
      throw new NotFoundException('Ticket not found.');
    }

    await this.assertAgentExists(assignedAgentId ?? undefined);
    this.assertMayAssign(assignedAgentId, current.assignedAgentId, caller);

    if (assignedAgentId === current.assignedAgentId) {
      // A no-op reassignment must not write a history row. Return the ticket
      // through the normal projection so the response shape never varies.
      return this.findOne(id);
    }

    // Same ordering reasoning as update() and setStatus(): the history insert
    // must run before the select that reports `_count.history`.
    const results = await this.prisma.$transaction([
      this.prisma.ticketHistory.createMany({
        data: [
          {
            ticketId: id,
            changedById: caller.id,
            // The SAME field name update() writes (Product rule 7) — Story 16's
            // History tab maps this literal to "Assigned agent".
            field: 'assignedAgentId',
            oldValue: current.assignedAgentId,
            newValue: assignedAgentId,
          },
        ],
      }),
      this.prisma.ticket.update({
        where: { id },
        data: {
          assignedAgent: assignedAgentId
            ? { connect: { id: assignedAgentId } }
            : { disconnect: true },
        },
        select: TICKET_SELECT,
      }),
    ]);
    const updated = results[results.length - 1];

    this.logger.log(
      { actorId: caller.id, ticketId: id, from: current.assignedAgentId, to: assignedAgentId },
      'Ticket reassigned',
    );

    return TicketsService.toResponse(updated as SelectedTicket);
  }
```

**File: `apps/api/src/tickets/tickets.controller.ts`** — add after `setStatus` (ends line 90):

```ts
  @Patch(':id/assignment')
  @RequirePermissions('tickets:write')
  @ApiOperation({
    summary: 'Assign or release a ticket',
    description:
      'Without tickets:assign the caller may only claim the ticket for themselves, ' +
      'or release one already assigned to them.',
  })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiForbiddenResponse({ description: 'The caller may not assign to that user.' })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  @ApiBadRequestResponse({ description: 'Unknown or inactive assignedAgentId.' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.assign(id, dto.assignedAgentId, caller);
  }
```

`@ApiForbiddenResponse` is already applied at the class level (line 26); the method-level one narrows the description and is the honest documentation for the one route where 403 is a business outcome rather than a missing permission.

### 5 — The dashboard DTOs

**Create file: `apps/api/src/dashboard/dto/agent-dashboard.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { TicketResponseDto } from '../../tickets/dto/ticket-response.dto';

/** One bucket of a breakdown. A flat array, not a keyed object: the frontend
 *  renders it in a fixed display order it owns, and a zero-count bucket is
 *  still present so a chart does not gain and lose axes between refreshes. */
export class DashboardBucketDto {
  @ApiProperty({ example: 'OPEN' })
  key!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class AgentTicketCountsDto {
  @ApiProperty({ example: 17, description: 'Tickets assigned to the caller, any status.' })
  assigned!: number;

  @ApiProperty({ example: 9, description: 'Caller-assigned tickets with status OPEN.' })
  open!: number;

  @ApiProperty({ example: 3, description: 'Caller-assigned tickets with status ON_HOLD.' })
  pending!: number;

  @ApiProperty({ example: 2, description: 'Caller-assigned active tickets past their priority threshold.' })
  overdue!: number;

  @ApiProperty({ example: 5, description: 'Tickets with no assigned agent — workable by anyone.' })
  unassigned!: number;

  @ApiProperty({ example: 4, description: 'Caller-assigned tickets moved to RESOLVED or CLOSED in the last 7 days.' })
  resolvedLast7Days!: number;
}

export class AgentTaskSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Call back about the invoice' })
  title!: string;

  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'], example: 'OPEN' })
  status!: string;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  dueAt!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  remindAt!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  ticketId!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  customerId!: string | null;

  @ApiProperty({ example: false, description: 'dueAt is in the past and status is neither DONE nor CANCELLED.' })
  isOverdue!: boolean;
}

export class AgentDashboardDto {
  @ApiProperty({ type: () => AgentTicketCountsDto })
  counts!: AgentTicketCountsDto;

  @ApiProperty({ type: [DashboardBucketDto], description: 'One bucket per TicketStatus, zeroes included.' })
  byStatus!: DashboardBucketDto[];

  @ApiProperty({ type: [DashboardBucketDto], description: 'One bucket per TicketPriority, zeroes included.' })
  byPriority!: DashboardBucketDto[];

  @ApiProperty({ type: [DashboardBucketDto], description: 'One bucket per TicketCategory, zeroes included.' })
  byCategory!: DashboardBucketDto[];

  @ApiProperty({ type: [TicketResponseDto], description: 'Up to 5 of the caller’s most pressing tickets.' })
  focusTickets!: TicketResponseDto[];

  @ApiProperty({ type: [TicketResponseDto], description: 'Up to 5 overdue tickets in the requested scope.' })
  overdueTickets!: TicketResponseDto[];

  @ApiProperty({ type: [TicketResponseDto], description: 'Up to 5 unassigned tickets the caller could pick up.' })
  unassignedTickets!: TicketResponseDto[];

  @ApiProperty({ type: [AgentTaskSummaryDto], description: 'Up to 5 of the caller’s open tasks, soonest due first. Empty if the caller lacks tasks:read.' })
  tasksDueSoon!: AgentTaskSummaryDto[];

  @ApiProperty({ example: 5, description: 'The cap applied to every embedded list above.' })
  listLimit!: number;

  @ApiProperty({ format: 'date-time', description: 'Server clock at computation time. Every overdue flag is relative to this.' })
  generatedAt!: string;
}
```

`_ = TicketCategory | TicketPriority | TicketStatus` are imported for the bucket enumeration in the service; if the linter flags an unused import here, drop them from this file and import them in the service instead.

**Create file: `apps/api/src/dashboard/dto/agent-dashboard-query.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TicketScope } from '../../tickets/dto/list-tickets-query.dto';

export class AgentDashboardQueryDto {
  @ApiPropertyOptional({
    enum: TicketScope,
    default: TicketScope.Mine,
    description: 'Which slice the breakdowns and lists cover. Defaults to the caller’s own tickets.',
  })
  @IsOptional()
  @IsEnum(TicketScope)
  scope: TicketScope = TicketScope.Mine;
}
```

Note the default differs from the list endpoint's: a **dashboard** defaults to `mine`, a **list** defaults to `all` (Product rule 3).

### 6 — `DashboardService`

**Create file: `apps/api/src/dashboard/dashboard.service.ts`**

Shape and required behaviour:

- Constructor takes `PrismaService` only.
- `async agentDashboard(query: AgentDashboardQueryDto, caller: AuthenticatedUser): Promise<AgentDashboardDto>`.
- `const now = new Date();` **once**, at the top. Every cutoff, every `isOverdue`, and `generatedAt` derive from that single value — otherwise two counters computed a millisecond apart can disagree.
- A private `scopeWhere(scope, caller): Prisma.TicketWhereInput` helper implementing Product rule 3, composed with `AND` exactly as task 2 does.
- A private `overdueWhere(now, scope, caller): Prisma.TicketWhereInput` returning
  ```ts
  {
    ...this.scopeWhere(scope, caller),
    status: { in: ACTIVE_TICKET_STATUSES },
    OR: overdueCutoffs(now).map(({ priority, before }) => ({
      priority,
      updatedAt: { lt: before },
    })),
  }
  ```
  This is the SQL-side computation Product rule 10 requires. **Careful:** if `scopeWhere` returned a `where.OR` this spread would clobber it — it does not (it uses `assignedAgentId` and `AND`), and a unit test must assert that.
- One `this.prisma.$transaction([...])` issuing every read at once, in this order (the array indices are how you unpack them, so keep them stable):
  1. `ticket.count({ where: mine })` — `assigned`
  2. `ticket.count({ where: { ...mine, status: 'OPEN' } })` — `open`
  3. `ticket.count({ where: { ...mine, status: PENDING_TICKET_STATUS } })` — `pending`
  4. `ticket.count({ where: overdueWhere(...) })` — `overdue`
  5. `ticket.count({ where: { assignedAgentId: null } })` — `unassigned`
  6. `ticket.count({ where: { ...mine, status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: sevenDaysAgo } } })` — `resolvedLast7Days`
  7. `ticket.groupBy({ by: ['status'], where: scoped, _count: { _all: true } })`
  8. `ticket.groupBy({ by: ['priority'], where: scoped, _count: { _all: true } })`
  9. `ticket.groupBy({ by: ['category'], where: scoped, _count: { _all: true } })`
  10. `ticket.findMany({ where: { ...scoped, status: { in: ACTIVE_TICKET_STATUSES } }, select: TICKET_SELECT, orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }], take: DASHBOARD_LIST_LIMIT })` — `focusTickets`
  11. `ticket.findMany({ where: overdueWhere(...), select: TICKET_SELECT, orderBy: { updatedAt: 'asc' }, take: DASHBOARD_LIST_LIMIT })` — `overdueTickets`
  12. `ticket.findMany({ where: { assignedAgentId: null, status: { in: ACTIVE_TICKET_STATUSES } }, select: TICKET_SELECT, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: DASHBOARD_LIST_LIMIT })` — `unassignedTickets`

  `orderBy: { priority: 'desc' }` sorts by the PostgreSQL enum's **declared** order, which is `LOW, MEDIUM, HIGH, URGENT` (schema lines 48–53) — so `desc` puts `URGENT` first. That is correct, and it is exactly the kind of thing a unit test should pin.
- `tasksDueSoon` is fetched **outside** that transaction, in its own guarded block:
  ```ts
    let tasksDueSoon: AgentTaskSummaryDto[] = [];

    // Product rule 8: degrade, do not 403. reporting-user holds dashboard:read
    // and nothing else.
    if (caller.permissions.includes('tasks:read')) {
      const tasks = await this.prisma.agentTask.findMany({
        where: { assigneeId: caller.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: AGENT_TASK_SUMMARY_SELECT,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        take: DASHBOARD_LIST_LIMIT,
      });
      tasksDueSoon = tasks.map((task) => DashboardService.toTaskSummary(task, now));
    }
  ```
  `orderBy: { dueAt: 'asc' }` puts PostgreSQL `NULL`s **last** by default on `ASC` — a task with no due date sorts after every dated one, which is what "due soon" means. Do not add `nulls: 'first'`.
- `AGENT_TASK_SUMMARY_SELECT` is a `satisfies Prisma.AgentTaskSelect` const at module scope, following the `TICKET_SELECT` doc-comment convention ("The ONLY projection used…").
- `toTaskSummary(task, now)` sets `isOverdue = task.dueAt !== null && task.dueAt < now && task.status !== 'DONE' && task.status !== 'CANCELLED'`.
- A private static `toBuckets<T extends string>(all: T[], rows: { _count: { _all: number } }[] , key)` that starts from the **full enum value list** and fills counts, so a zero-count bucket is present (the `DashboardBucketDto` doc comment states this contract). Use `Object.values(TicketStatus)` etc. as the source of truth.
- `listLimit: DASHBOARD_LIST_LIMIT`, `generatedAt: now.toISOString()`.

### 7 — `DashboardController` and `DashboardModule`

**Create file: `apps/api/src/dashboard/dashboard.controller.ts`**

```ts
@ApiTags('dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('agent')
  @RequirePermissions('dashboard:read')
  @ApiOperation({
    summary: 'Everything the agent dashboard renders, in one call',
    description:
      'Counts, breakdowns, and three capped ticket lists. tasksDueSoon is empty ' +
      'unless the caller also holds tasks:read.',
  })
  @ApiOkResponse({ type: AgentDashboardDto })
  agent(
    @Query() query: AgentDashboardQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AgentDashboardDto> {
    return this.dashboardService.agentDashboard(query, caller);
  }
}
```

**Create file: `apps/api/src/dashboard/dashboard.module.ts`** — modelled on `apps/api/src/org/org.module.ts`:

```ts
@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

It needs **no** `TicketsModule` import: it imports `TICKET_SELECT`-shaped projections and the `ticket-insights.ts` constants directly and talks to `PrismaService` itself, which `PrismaModule` provides globally. **Do not** inject `TicketsService` — that would create a `TicketsModule` to `DashboardModule` edge for no gain.

`TICKET_SELECT` is currently module-private in `tickets.service.ts` (line 20, `const`, not exported). **Export it** (`export const TICKET_SELECT`) and export the `SelectedTicket` type beside it, plus a `static toResponse` that is already static. Reuse `TicketsService.toResponse` from the dashboard by making it `public static` — it is already `private static` at line 280, so the change is one keyword. This keeps exactly one ticket projection and one mapper in the codebase, matching the "The ONLY projection" rule.

### 8 — Register the module and the Swagger tag

**File: `apps/api/src/app.module.ts`** — add `import { DashboardModule } from './dashboard/dashboard.module';` beside the others (lines 6–13) and `DashboardModule,` to the `imports` array after `TicketsModule` (line 59).

**File: `apps/api/src/main.ts`** — add to the `DocumentBuilder` chain after the `ticket-history` tag (line 55):

```ts
    .addTag('dashboard', 'Aggregated agent dashboard reads')
```

---

## Edge Cases & Failure Modes

- **A caller with `dashboard:read` but no `tickets:read`.** `reporting-user` holds `tickets:read` today, but the combination is expressible. The dashboard does **not** re-check `tickets:read` — `dashboard:read` is the gate (Product rule 8), and the dashboard returns aggregates plus at most 15 ticket rows. Documented as intentional; if that is ever unacceptable, the fix is a second `@RequirePermissions` key, not a runtime branch.
- **A caller with `dashboard:read` but no `tasks:read`** (`reporting-user`) → `tasksDueSoon: []`, HTTP 200. Enforced by the `caller.permissions.includes('tasks:read')` branch in task 6.
- **A brand-new agent with zero assigned tickets** → every count `0`, every bucket present with `count: 0`, every list `[]`. The `toBuckets` helper is what guarantees the buckets are present rather than the array being empty — assert this explicitly in the unit spec, because an empty `groupBy` result is the natural but wrong outcome.
- **`scope=workable` combined with `search=`** on `GET /api/tickets` → both apply. This is the bug the `where.AND` composition in task 2 exists to prevent; assigning to `where.OR` instead would silently drop the search term and return too many rows. Covered by a dedicated unit test.
- **A ticket updated one second ago with `URGENT` priority** → not overdue (threshold 4 h). **A `LOW` ticket untouched for 71 hours** → not overdue; at 73 hours → overdue. The boundary is `updatedAt < now - threshold`, strictly less than. Pin both sides in the unit spec using an injected `now`.
- **A `RESOLVED` ticket untouched for a year** → never overdue, because `status: { in: ACTIVE_TICKET_STATUSES }` excludes it. This is the single most likely mis-implementation: dropping that clause makes every closed ticket overdue forever.
- **Editing a ticket resets its overdue clock**, because the threshold is measured from `updatedAt` and any `PATCH` bumps it — including a comment? **No:** `TicketComment` is a separate table, so commenting does *not* bump `Ticket.updatedAt`. Adding a comment therefore does **not** clear the overdue flag. Recorded as accepted behaviour, not a bug: "overdue" means the ticket record itself has not moved.
- **A `support-agent` (no `tickets:assign`) sending `PATCH /api/tickets/:id/assignment` with a colleague's uuid** → `403` with "You may only assign a ticket to yourself…". Enforced in `assertMayAssign`.
- **The same agent sending `PATCH /api/tickets/:id` with `{ assignedAgentId: '<colleague>' }`** → also `403`, via the same guard wired into `update()`. **This is a behaviour change to a Story-14 route** — see Migration / Rollback.
- **The same agent sending `{ assignedAgentId: null }` on a ticket assigned to someone else** → `403`. Releasing is permitted only for a ticket assigned to the caller.
- **The same agent claiming an unassigned ticket** → allowed (`nextAssigneeId === caller.id`).
- **Assigning to an inactive user** → `400` "Cannot assign an inactive user", from the existing `assertAgentExists` (lines 261–278), which runs **before** `assertMayAssign` in `assign()`. Order matters: a `400` for a nonexistent user is more useful than a `403` about permissions.
- **Assigning a ticket to the agent it is already assigned to** → 200, and **no** `TicketHistory` row (the `assignedAgentId === current.assignedAgentId` early return). Without that branch, a UI that fires the control on every render floods the history tab.
- **`PATCH /api/tickets/:id/assignment` with a body of `{}`** → `400`. `AssignTicketDto.assignedAgentId` is `@IsOptional()` for the `null` case, so an absent key passes validation but reaches the service as `undefined`; **guard it in the controller or make the DTO reject it** — the simplest correct form is `@IsUUID()` plus `@IsOptional()` and a service-level `dto.assignedAgentId ?? null` normalisation, which turns absent into "release". Choose the explicit form: normalise `undefined` to `null` in the controller call (`dto.assignedAgentId ?? null`) and document that an empty body releases the ticket.
- **`scope` sent as `MINE` (uppercase)** → `400` from `@IsEnum`. The enum values are lowercase strings; there is no case-insensitive coercion.
- **An unknown query key on either endpoint** → `400` under `forbidNonWhitelisted` (`main.ts` lines 27–34). Already covered for `/tickets` by an existing e2e test; add the same for `/dashboard/agent`.
- **Clock skew between the API host and the database.** `now` comes from the Node process, and every cutoff is computed there and sent as a bound parameter, so a database with a different clock cannot shift the answer. `Ticket.updatedAt` is written by Prisma's `@updatedAt`, i.e. also by the application. Consistent by construction.
- **A dashboard call while a ticket is being reassigned.** Every count and list is inside one `$transaction`, so the whole snapshot is consistent; `tasksDueSoon`, fetched outside it, can be a moment newer. Accepted — tasks and ticket counts are not compared against each other anywhere in the UI.

---

## Test Plan

1. **`apps/api/src/tickets/ticket-insights.spec.ts`** (new, unit). Cover: `OVERDUE_AFTER_HOURS` has an entry for all four `TicketPriority` values (iterate `Object.values(TicketPriority)` so adding a priority fails the test); `ACTIVE_TICKET_STATUSES` excludes `RESOLVED` and `CLOSED`; `overdueCutoffs(fixedNow)` returns four entries with the exact expected instants; `DASHBOARD_LIST_LIMIT` is 5.
2. **`apps/api/src/dashboard/dashboard.service.spec.ts`** (new, unit). Modelled on `apps/api/src/tickets/tickets.service.spec.ts` (365 lines) — same jest-mocked `PrismaService` shape. Cover:
   - the `$transaction` array is issued with the expected number of operations, in the documented order;
   - `scopeWhere` for each of the four `TicketScope` values, including that `workable` uses `AND`+`OR` and **never** writes a bare `where.OR`;
   - `overdueWhere` includes `status: { in: ACTIVE_TICKET_STATUSES }` and one `OR` term per priority with the correct `updatedAt: { lt }` bound for an injected `now`;
   - `byStatus`/`byPriority`/`byCategory` contain **every** enum value even when `groupBy` returns `[]`, with `count: 0`;
   - `focusTickets` orders `priority: 'desc'` then `updatedAt: 'asc'` and takes `DASHBOARD_LIST_LIMIT`;
   - `tasksDueSoon` is `[]` when `caller.permissions` lacks `tasks:read`, and populated when it holds it — assert `prisma.agentTask.findMany` was **not called** in the first case;
   - `isOverdue` on a task: true for a past `dueAt` with status `OPEN`; false for a past `dueAt` with status `DONE`; false for `dueAt: null`;
   - `generatedAt` equals the single `now` used for every cutoff.
3. **`apps/api/src/tickets/tickets.service.spec.ts`** (extend). Add:
   - `list()` with each `scope` value produces the expected `where` — and `scope: 'workable'` together with `search: 'login'` keeps **both** the `OR` search clause and the `AND` assignment clause;
   - `assign()` happy path writes one `TicketHistory` row with `field: 'assignedAgentId'` and the correct `oldValue`/`newValue`, inside a `$transaction`, history-insert **first**;
   - `assign()` to the current assignee writes **no** history row and returns via `findOne`;
   - `assign()` throws `ForbiddenException` when the caller lacks `tickets:assign` and the target is neither the caller nor a self-release;
   - `assign()` permits self-claim and self-release without `tickets:assign`;
   - `assign()` permits any target when the caller **holds** `tickets:assign`;
   - `assertAgentExists` runs before the permission guard (an unknown uuid gives `400`, not `403`);
   - `update()` with `{ assignedAgentId: '<other>' }` and no `tickets:assign` throws `ForbiddenException` — **the bypass test**;
   - `update()` with `{ priority: 'HIGH' }` and no `assignedAgentId` is unaffected by the guard;
   - `create()` with no `assignedAgentId` is unaffected; `create()` with a foreign `assignedAgentId` and no permission throws.
4. **`apps/api/test/dashboard.e2e-spec.ts`** (new). Modelled on `apps/api/test/tickets.e2e-spec.ts`'s harness (lines 1–70, including the `beforeAll` that reproduces `main.ts`'s pipe/filter/Swagger setup). Cover:
   - `GET /api/dashboard/agent` unauthenticated → `401`;
   - as the seeded administrator → `200`, and the body has every documented key with `listLimit: 5` and a parseable `generatedAt`;
   - `byStatus` has exactly 5 entries, `byPriority` 4, `byCategory` 7 — the enum cardinalities, so adding an enum value without updating the dashboard fails here;
   - every embedded list has `length <= 5`;
   - `scope=all` and `scope=unassigned` both `200`; `scope=bogus` → `400`; an unknown query key → `400`;
   - as a fresh `support-agent` with no tickets → all counts `0`, all buckets present, all lists `[]`, `tasksDueSoon: []` (they hold `tasks:read` but own no tasks);
   - as a `customer`-role account → `403`;
   - as a `reporting-user`-role account → `200` with `tasksDueSoon: []`;
   - create a ticket assigned to a fixture agent, back-date nothing, and assert it appears in that agent's `focusTickets` and increments `counts.assigned`/`counts.open`.
5. **`apps/api/test/tickets.e2e-spec.ts`** (extend). Add:
   - `GET /api/tickets?scope=mine` returns only tickets assigned to the caller; `?scope=unassigned` returns only unassigned; `?scope=workable` returns the union; `?scope=all` and an omitted `scope` return identical bodies (**the backward-compatibility proof**);
   - `?scope=workable&search=<subject substring>` returns the matching ticket and not an unrelated workable one;
   - `PATCH /api/tickets/:id/assignment` as the administrator sets and clears the assignment and each call adds a `history` entry visible through `GET /api/tickets/:id/history` with `field: 'assignedAgentId'`;
   - a repeat `PATCH` with the same value adds **no** further history entry;
   - as a `support-agent`: claiming an unassigned ticket → `200`; assigning it to a second agent → `403`; releasing their own → `200`; releasing one assigned to the second agent → `403`;
   - as a `support-agent`, `PATCH /api/tickets/:id` with `{ assignedAgentId: '<other agent>' }` → `403` (the bypass is closed);
   - as a `support-supervisor` (holds `tickets:assign`), assigning to another agent → `200`;
   - assignment to an inactive user → `400`; to an unknown uuid → `400`; on an unknown ticket id → `404`.
6. **Existing suites must pass unmodified**, especially `apps/api/test/tickets.e2e-spec.ts`'s pre-existing `support-agent` block at lines 323–352 — it sends only `{ priority: 'HIGH' }`, so the new guard does not touch it. **If that test starts failing, the guard is firing on absent keys** and the `!== undefined` check is wrong.

---

## Migration / Rollback

**No database migration.** This story is code-only.

**One deliberate breaking change.** Before this story, any `tickets:write` holder could reassign any ticket to anyone through `PATCH /api/tickets/:id`. After it, a caller without `tickets:assign` gets `403` for anything but a self-claim or self-release. The affected seeded role is **`support-agent`** — the only role with `tickets:write` and without `tickets:assign`.

- **Who notices:** nothing in the repo. Story 16's `TicketFormView.vue` exposes an assignee `<select>`, so a `support-agent` using it to pick a colleague will now see the inline error surfaced by `toErrorMessage` ("You do not have permission to do this (…)"). Story 21 is where that control gets gated on `auth.can('tickets:assign')`; until then the failure is a clear error message, not a crash.
- **Rollback of the guard alone:** delete the two `assertMayAssign` call sites in `create()` and `update()` and leave the new `assignment` route in place. The route keeps its own guard, so reassignment stays permissioned *through the new path* while the old path reopens. This is the minimal revert if the change proves too disruptive mid-sprint — but it reopens the bypass, so record it as temporary if used.
- **Rollback of the whole story:** remove `DashboardModule` from `app.module.ts`, delete `apps/api/src/dashboard/`, delete `ticket-insights.ts`, revert the three `tickets/` files and the `main.ts` tag. Nothing persists, so there is no half-applied state to repair.

---

## Verification Steps

1. **Typecheck:** `npm run typecheck --workspace @crm/api`.
2. **Lint:** `npm run lint --workspace @crm/api`.
3. **Unit tests:** `npm run test --workspace @crm/api`.
4. **Backend builds:** `npm run build --workspace @crm/api`.
5. **E2E:** `npm run test:e2e --workspace @crm/api` — the two new/extended suites plus every existing one.
6. **API starts:** `npm run dev:api` from the repo root, no startup error (a `DashboardModule` dependency mistake surfaces here as a Nest resolution error, not at compile time).
7. **Swagger:** open `http://localhost:3000/api/docs` and confirm a **dashboard** tag with `GET /api/dashboard/agent`, and that `PATCH /api/tickets/{id}/assignment` appears under **tickets** with its 403 description.
8. **Manual, as the administrator:** call `GET /api/dashboard/agent`, then `?scope=all`, then `?scope=unassigned`; confirm the counts move sensibly and `generatedAt` advances.
9. **Manual overdue proof:** hand-update one ticket's `updated_at` back by 5 days via `npm run prisma:studio` (or a direct `UPDATE`), set it `URGENT` and `OPEN`, then confirm it appears in `overdueTickets` and increments `counts.overdue`; set its status to `CLOSED` and confirm it leaves both.
10. **Manual permission proof:** sign in as a `support-agent` fixture; confirm claim works, colleague-assignment `403`s on **both** `PATCH /tickets/:id/assignment` and `PATCH /tickets/:id`; sign in as a `support-supervisor` and confirm colleague-assignment succeeds.
11. **Regression:** confirm `GET /api/tickets` with **no** `scope` returns exactly what it returned before this story (same items, same order, same meta) — the diff should be provable by running the pre-existing e2e list tests unmodified.
12. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.

---

## Done Criteria

- [ ] `apps/api/src/tickets/ticket-insights.ts` exists and is the **only** place the overdue thresholds, active statuses, and list cap are defined.
- [ ] `GET /api/dashboard/agent` exists under `dashboard:read`, returns every documented field, and computes overdue-ness in SQL from a single `now`.
- [ ] Every breakdown returns **all** enum buckets including zeroes.
- [ ] Every embedded list is capped at `DASHBOARD_LIST_LIMIT` and the response reports that cap.
- [ ] `tasksDueSoon` degrades to `[]` without `tasks:read` instead of returning `403`.
- [ ] `GET /api/tickets` accepts `scope` with the four documented values; omitting it is byte-identical to `scope=all`; `scope=workable` composes correctly with `search`.
- [ ] `PATCH /api/tickets/:id/assignment` exists, writes one `TicketHistory` row with `field: 'assignedAgentId'`, and is a no-op (no history row) when the value is unchanged.
- [ ] `assertMayAssign` is enforced in `assign()`, `create()`, **and** `update()` — the `PATCH /api/tickets/:id` bypass is closed and there is an e2e test proving it.
- [ ] `TICKET_SELECT` and `TicketsService.toResponse` are shared rather than duplicated in the dashboard.
- [ ] `DashboardModule` is registered in `app.module.ts` and tagged in Swagger.
- [ ] No frontend file and no Prisma file was modified.
- [ ] All new and existing unit specs and e2e suites pass; full-repo typecheck/lint/test/build pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 19.**
