# Story 19 — Agent tasks, quick replies, and the unified communication timeline API (Story: 5)

## Prerequisites

- [Story 18 completed](18-story-agent-dashboard-api-5.md): `GET /api/dashboard/agent` exists and already reads `prisma.agentTask` for its `tasksDueSoon` list. This story builds the CRUD that populates those rows, so the dashboard's task list stays empty until this story lands.
- [Story 17 completed](17-story-agent-workspace-data-model-5.md): `agent_tasks`, `quick_replies`, `customer_interactions.ticket_id`, and the three new `InteractionChannel` values all exist.
- PostgreSQL running; `npm run dev:api` starts cleanly.
- **No frontend change and no migration is permitted in this story.**

---

## Story Goal

1. **Agent tasks and reminders API** — a new `tasks` module with full CRUD, scoped to the caller by default, with `tasks:manage` as the "act on someone else's task" gate.
2. **Quick replies API** — a new `quick-replies` module: read for every agent, write for `quick-replies:write` holders only.
3. **Communication channel metadata** — one registry describing all eight `InteractionChannel` values and, for each, whether an agent may log an outbound response from the workspace. Exposed as `GET /api/communication/channels`.
4. **The unified interaction timeline** — `CustomerInteraction` gains its `ticketId` in the DTOs; the customer timeline gains `channel`/`ticketId` filters; and a **new ticket-scoped route family** `GET|POST /api/tickets/:ticketId/interactions` links a logged interaction to the ticket the agent is working.

**Not in scope:** any external provider integration (no SMTP, no WhatsApp Business API, no SMS gateway, no chat socket) — see Product rules; any frontend file (Stories 20–21); notifications, schedulers, or reminder delivery; any migration.

---

## Context — Read These Files First

1. `apps/api/src/customers/interactions.service.ts` — full file (122 lines). This is the file you extend and the template for the ticket-scoped variant:
   - `FIVE_MINUTES_MS` (line 14) and the future-date guard in `create()` (63–65) — reused verbatim, do **not** re-derive it.
   - `INTERACTION_SELECT` (16–27) — gains `ticketId` and a `ticket` ref.
   - `list()` (42–52), including `orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }]` at line 48 — the two-key sort is what makes "chronological" deterministic when two interactions share an `occurredAt`. Keep both keys.
   - `remove()` (88–107) — the author-or-`ARCHIVE_PERMISSION` rule.
   - `toResponse()` (109–121).
2. `apps/api/src/customers/interactions.controller.ts` — full file (82 lines). `@Controller('customers/:customerId/interactions')` at line 34; `list` gated on `customers:read` (39), `create` on `interactions:write` (48), `remove` on `interactions:write` (65) with `@HttpCode(HttpStatus.NO_CONTENT)` (66). The doc string at 69 records "There is no edit route" — that stays true.
3. `apps/api/src/customers/dto/interaction.dto.ts` — full file (62 lines). `CreateInteractionDto` (6–33) gains `ticketId`; `InteractionResponseDto` (35–62) gains `ticketId` and `ticket`.
4. `apps/api/src/tickets/ticket-comments.service.ts` — full file (119 lines). The **exact** template for `AgentTasksService`: `assertScoped()` (96–107) as the "404 before you touch a child row" pattern, the author-only edit rule (67–69), and the author-or-elevated delete rule (85–89) using `caller.permissions.includes(TICKET_MANAGE_PERMISSION)`.
5. `apps/api/src/tickets/ticket-comments.controller.ts` — full file (93 lines). The nested-route controller shape: `@Controller('tickets/:ticketId/comments')`, `@Param('ticketId', ParseUUIDPipe)` on every method.
6. `apps/api/src/tickets/tickets.service.ts` — lines **11–35** (`TICKET_MANAGE_PERMISSION`, `TICKET_ASSIGN_PERMISSION` added by Story 18, `CUSTOMER_REF_SELECT`, the exported `TICKET_SELECT`), **238–248** (`assertExists`, public precisely so nested services can 404 first), **250–259** (`assertCustomerExists`), **261–278** (`assertAgentExists`).
7. `apps/api/src/customers/customers.service.ts` lines **1–48** — the exported `USER_REF_SELECT` (21–25) and `ARCHIVE_PERMISSION` (19). Also grep for `assertExists` in that file: `InteractionsService` already calls `this.customersService.assertExists(customerId)`.
8. `apps/api/src/customers/customers.module.ts` — full file (30 lines). `exports: [CustomersService]` at line 28. **`InteractionsService` must be added to that exports array** so the tickets module can inject it.
9. `apps/api/src/tickets/tickets.module.ts` — full file (31 lines). Already `imports: [AuthModule, CustomersModule]` (line 15), so once `CustomersModule` exports `InteractionsService`, the new ticket-scoped controller can inject it with no new module edge.
10. `apps/api/src/users/users.controller.ts` and `apps/api/src/users/dto/list-users-query.dto.ts` — the paginated-list-with-filters template, for `ListAgentTasksQueryDto`.
11. `apps/api/src/common/dto/pagination.dto.ts` — full file (39 lines). `PaginationQueryDto` (lines 5–18 of the class body: `page`, `pageSize` with initialisers), `PaginationMetaDto`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`. `ListAgentTasksQueryDto` extends this.
12. `apps/api/src/org/org.module.ts` and `apps/api/src/org/org.service.ts` — the smallest CRUD module in the repo; the template for `QuickRepliesModule`, which needs neither pagination nor nesting.
13. `apps/api/src/main.ts` lines **42–58** — the Swagger tag list; add three tags.
14. `apps/api/src/app.module.ts` lines **6–13** and **54–61** — register `TasksModule` and `QuickRepliesModule`.
15. `apps/api/test/customer-children.e2e-spec.ts` — the e2e template for a nested route family (notes/attachments/interactions on a customer). `apps/api/test/ticket-children.e2e-spec.ts` is the ticket-side equivalent and the file the new ticket-interactions tests belong in.
16. [`.squad/plans/customer-management/11-story-customer-notes-attachments-interactions-3.md`](../customer-management/11-story-customer-notes-attachments-interactions-3.md) — the precedent for a nested child-resource story: one service per child, `assertExists` on the parent first, permission key per write action.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **No external communication provider is implemented.** No SMTP client, no WhatsApp/Twilio SDK, no websocket chat transport, no webhook receiver. Every "response through a channel" is a `CustomerInteraction` row with `direction: OUTBOUND` and the chosen `channel`. | The intake is explicit: "Do not implement external communication provider integrations unless they are already part of the existing project scope; use the existing abstraction/interfaces where applicable." Nothing in work items 1–4 opens an outbound socket, so the existing abstraction **is** `CustomerInteraction`. Adding a provider would need credentials, env vars, and a delivery-status model this work item excludes. |
| 2 | The "communication abstraction" surfaced to the frontend is a **static registry**, `CHANNEL_REGISTRY`, keyed by `InteractionChannel`, with `{ key, canRespond, isRealtime, providerConfigured }` per channel. `providerConfigured` is **`false` for every channel** today. | This is the seam Product rule 1 leaves open: a future work item flips `providerConfigured` and adds a sender behind it without the frontend changing shape. `canRespond` answers the question Story 21 actually asks — "does this channel get a Respond button?" |
| 3 | `canRespond` is **`true`** for `EMAIL`, `WHATSAPP`, `SMS`, `CHAT`, `WEB_FORM` and **`false`** for `PHONE` and `MEETING`. `OTHER` is `true`. | The five the intake names are exactly the five respondable ones. A phone call and a meeting are logged after the fact, not replied to in a text box — offering a Respond box there would be a lie. |
| 4 | An interaction's `ticketId`, when present, **must belong to the same customer** as the interaction. Enforced in the service with a `400`; there is no database constraint (Story 17 Edge Cases flags this). | The schema cannot express a cross-table equality. Without the check, an agent could attach a Cairo customer's call to a Riyadh customer's ticket and the timeline would silently lie. |
| 5 | `POST /api/tickets/:ticketId/interactions` derives `customerId` **from the ticket**, and the client does **not** send it. | The ticket already knows its customer (`Ticket.customerId`, non-nullable). Accepting a `customerId` here would create a second way to get rule 4 wrong. |
| 6 | The ticket-scoped timeline route reads under **`tickets:read`** and writes under **`interactions:write`**. | Reuses work item 4's "one read key covers the ticket and all its children" decision and work item 3's existing write key. No new interaction permission is introduced. |
| 7 | `GET /api/customers/:customerId/interactions` keeps returning **every** interaction for that customer, ticket-linked or not, unless a `ticketId` filter is supplied. The new query params are all optional. | Backward compatibility with Story 11's contract and Story 12's `CustomerDetailView.vue`, which calls it with no params. |
| 8 | There is still **no edit route** for an interaction — create and delete only, exactly as Story 11 decided. `ticketId` can be corrected only by deleting and re-logging. | The existing controller doc comment (line 69) states this; re-opening it now would be scope creep and would need an audit trail the model has no room for. |
| 9 | `AgentTask` list defaults to **the caller's own tasks** (`scope=mine`). `scope=all` requires **`tasks:manage`** — unlike tickets, where `scope=all` is open to any reader. | A personal to-do list is not shared data. `tasks:read` means "read your tasks"; seeing a colleague's backlog is the supervisor capability, and `tasks:manage` is already the key that distinguishes them (Story 17 Product rule 10). |
| 10 | Creating a task **for someone else** requires `tasks:manage`; without it, `assigneeId` must be the caller (or absent, defaulting to the caller). Updating or deleting a task assigned to someone else requires `tasks:manage`. | Same claim-and-release shape as Story 18's assignment rule, and the same reason: delegation is a supervisor action. |
| 11 | Setting a task's status to `DONE` stamps `completedAt`; moving it **out** of `DONE` clears `completedAt` back to `null`. `CANCELLED` does **not** stamp it. | `completedAt` must mean "when it was finished", so re-opening a task has to clear it or the dashboard's history is wrong. Cancelling is not completing. |
| 12 | A task's `dueAt` and `remindAt` may be in the past or the future, with **no** validation either way. Only `remindAt <= dueAt` is *not* enforced. | Back-dating a missed reminder is legitimate. Unlike `CustomerInteraction.occurredAt` — which records something that *happened* and therefore cannot be in the future — a task records an intention. The asymmetry is deliberate; it is why the `FIVE_MINUTES_MS` guard is not copied here. |
| 13 | `QuickReply` reads are filtered to `isActive: true` for `quick-replies:read` callers; a `quick-replies:write` holder can pass `includeInactive=true` to see the whole catalogue. | Deactivating a stale reply must hide it from the picker without deleting it and breaking a `key` a translator still maintains. |
| 14 | `DELETE /api/quick-replies/:id` is a **hard delete**, and a seeded row deleted this way **comes back on the next seed run**. | The seed upserts on `[key, locale]` (Story 17 task 9). Documented so nobody treats the reappearance as a bug; `isActive: false` is the correct way to retire a seeded reply. |

---

## Backend Tasks

### 1 — The channel registry

**Create file: `apps/api/src/customers/channel.registry.ts`**

Lives beside `interactions.service.ts` because `CustomerInteraction` *is* the communication abstraction (Product rule 1), and putting it in a new `communication/` folder would imply a transport layer that does not exist.

```ts
import { InteractionChannel } from '@prisma/client';

/**
 * The communication abstraction this project actually has. There is NO outbound
 * provider anywhere in work items 1–5 (Product rule 1): "responding through a
 * channel" means logging a CustomerInteraction with direction OUTBOUND.
 *
 * `canRespond`        — the workspace offers a Respond composer for this channel.
 * `isRealtime`        — the channel is conversational rather than logged-after-the-fact.
 *                       Drives ordering hints in the UI, nothing else.
 * `providerConfigured`— an external sender is wired up. FALSE for every channel
 *                       today; this is the seam a future work item flips.
 */
export interface ChannelDescriptor {
  key: InteractionChannel;
  canRespond: boolean;
  isRealtime: boolean;
  providerConfigured: boolean;
}

export const CHANNEL_REGISTRY: Record<InteractionChannel, ChannelDescriptor> = {
  [InteractionChannel.EMAIL]:    { key: InteractionChannel.EMAIL,    canRespond: true,  isRealtime: false, providerConfigured: false },
  [InteractionChannel.WHATSAPP]: { key: InteractionChannel.WHATSAPP, canRespond: true,  isRealtime: true,  providerConfigured: false },
  [InteractionChannel.CHAT]:     { key: InteractionChannel.CHAT,     canRespond: true,  isRealtime: true,  providerConfigured: false },
  [InteractionChannel.SMS]:      { key: InteractionChannel.SMS,      canRespond: true,  isRealtime: false, providerConfigured: false },
  [InteractionChannel.WEB_FORM]: { key: InteractionChannel.WEB_FORM, canRespond: true,  isRealtime: false, providerConfigured: false },
  [InteractionChannel.PHONE]:    { key: InteractionChannel.PHONE,    canRespond: false, isRealtime: true,  providerConfigured: false },
  [InteractionChannel.MEETING]:  { key: InteractionChannel.MEETING,  canRespond: false, isRealtime: false, providerConfigured: false },
  [InteractionChannel.OTHER]:    { key: InteractionChannel.OTHER,    canRespond: true,  isRealtime: false, providerConfigured: false },
};

/** Display order for the frontend's channel filter and picker. */
export const CHANNEL_ORDER: InteractionChannel[] = [
  InteractionChannel.EMAIL,
  InteractionChannel.WHATSAPP,
  InteractionChannel.CHAT,
  InteractionChannel.SMS,
  InteractionChannel.WEB_FORM,
  InteractionChannel.PHONE,
  InteractionChannel.MEETING,
  InteractionChannel.OTHER,
];
```

Typing `CHANNEL_REGISTRY` as `Record<InteractionChannel, ChannelDescriptor>` makes a future ninth enum value a **compile error** here — that is the point, so do not widen it to `Partial<Record<...>>`.

**Create file: `apps/api/src/customers/dto/channel.dto.ts`** — a `ChannelDescriptorDto` with the four `@ApiProperty` fields, plus a `ChannelListDto { items: ChannelDescriptorDto[] }`. Return an object wrapper, not a bare array, so a `defaultChannel` hint can be added later without a breaking change.

**Create file: `apps/api/src/customers/channels.controller.ts`**

```ts
@ApiTags('communication')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('communication/channels')
export class ChannelsController {
  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'The communication channels this deployment knows about',
    description:
      'Static metadata. providerConfigured is false for every channel — no ' +
      'external sender is implemented; responding logs an OUTBOUND interaction.',
  })
  @ApiOkResponse({ type: ChannelListDto })
  list(): ChannelListDto {
    return { items: CHANNEL_ORDER.map((key) => CHANNEL_REGISTRY[key]) };
  }
}
```

No service — the registry is a constant and a one-line map does not earn an injectable. Register the controller in `customers.module.ts`'s `controllers` array (lines 15–20). Gate on `customers:read` because every staff role that can see an interaction already holds it (`support-agent` included, seed line 130).

### 2 — Interaction DTOs gain `ticketId`

**File: `apps/api/src/customers/dto/interaction.dto.ts`**

Add to `CreateInteractionDto` (after `occurredAt`, line 32):

```ts
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional ticket this interaction belongs to. MUST belong to the same ' +
      'customer — a mismatch is a 400 (Product rule 4).',
  })
  @IsOptional()
  @IsUUID()
  ticketId?: string;
```

Add a small ref DTO and two fields to `InteractionResponseDto`:

```ts
/** The ticket an interaction is attributed to. Two fields: enough to render a
 *  link, nothing that duplicates TicketResponseDto. */
export class InteractionTicketRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Cannot log in after password reset' })
  subject!: string;
}
```

```ts
  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  ticketId!: string | null;

  @ApiProperty({ type: () => InteractionTicketRefDto, nullable: true })
  ticket!: InteractionTicketRefDto | null;
```

**Create file: `apps/api/src/customers/dto/list-interactions-query.dto.ts`**

```ts
export class ListInteractionsQueryDto {
  @ApiPropertyOptional({ enum: InteractionChannel })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({ enum: InteractionDirection })
  @IsOptional()
  @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only interactions attributed to this ticket.' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;
}
```

Not paginated — matching the existing timeline, which returns the whole history for one customer (Story 11's decision). Note this in the DTO doc comment so it is a recorded choice rather than an oversight.

### 3 — `InteractionsService` extensions

**File: `apps/api/src/customers/interactions.service.ts`**

`INTERACTION_SELECT` (16–27) gains:

```ts
  ticketId: true,
  ticket: { select: { id: true, subject: true } },
```

`list()` (42–52) takes an optional query:

```ts
  async list(customerId: string, query: ListInteractionsQueryDto = {}): Promise<InteractionResponseDto[]> {
    await this.customersService.assertExists(customerId);

    const where: Prisma.CustomerInteractionWhereInput = { customerId };

    if (query.channel) where.channel = query.channel;
    if (query.direction) where.direction = query.direction;
    if (query.ticketId) where.ticketId = query.ticketId;

    const interactions = await this.prisma.customerInteraction.findMany({
      where,
      select: INTERACTION_SELECT,
      // Both keys: occurredAt is agent-supplied and two interactions can share
      // it, so createdAt is the tiebreak that makes the timeline deterministic.
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return interactions.map((interaction) => InteractionsService.toResponse(interaction));
  }
```

Default `query` to `{}` so every existing call site keeps compiling.

Add the cross-customer guard next to the other asserts:

```ts
  /**
   * Product rule 4. The schema cannot express "the ticket's customer equals the
   * interaction's customer", so this is the only thing standing between the
   * timeline and a silently wrong attribution.
   */
  private async assertTicketBelongsToCustomer(customerId: string, ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, customerId: true },
    });

    if (!ticket) {
      throw new BadRequestException('Unknown ticketId.');
    }

    if (ticket.customerId !== customerId) {
      throw new BadRequestException('That ticket belongs to a different customer.');
    }
  }
```

`create()` (54–86) calls it when `dto.ticketId` is present, after the `occurredAt` guard, and passes `ticketId: dto.ticketId` into the `data` object. `toResponse()` (109–121) adds `ticketId: interaction.ticketId` and `ticket: interaction.ticket`.

**File: `apps/api/src/customers/interactions.controller.ts`** — `list()` (43–45) takes `@Query() query: ListInteractionsQueryDto` and forwards it. Everything else is unchanged.

### 4 — The ticket-scoped timeline

**File: `apps/api/src/customers/customers.module.ts`** — change line 28 to:

```ts
  exports: [CustomersService, InteractionsService],
```

**Create file: `apps/api/src/tickets/ticket-interactions.controller.ts`**

```ts
@ApiTags('ticket-interactions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tickets/:ticketId/interactions')
export class TicketInteractionsController {
  constructor(private readonly ticketInteractionsService: TicketInteractionsService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({
    summary: 'The communication timeline for one ticket, newest-occurred first',
    description:
      'By default only interactions attributed to this ticket. Pass ' +
      'includeCustomerHistory=true for the customer’s whole timeline, which is ' +
      'what the workspace renders.',
  })
  @ApiOkResponse({ type: [InteractionResponseDto] })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  list(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query() query: ListTicketInteractionsQueryDto,
  ): Promise<InteractionResponseDto[]> {
    return this.ticketInteractionsService.list(ticketId, query);
  }

  @Post()
  @RequirePermissions('interactions:write')
  @ApiOperation({
    summary: 'Log an interaction against this ticket',
    description:
      'The customer is derived from the ticket; do not send customerId. This is ' +
      'how "responding through a channel" is recorded — no external message is sent.',
  })
  @ApiCreatedResponse({ type: InteractionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or occurredAt is in the future.' })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateTicketInteractionDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    return this.ticketInteractionsService.create(ticketId, dto, caller);
  }
}
```

**Create file: `apps/api/src/tickets/dto/ticket-interaction.dto.ts`**

- `CreateTicketInteractionDto` — the same four required fields as `CreateInteractionDto` (`channel`, `direction`, `subject`, `occurredAt`) plus optional `body`, and **no** `customerId` and **no** `ticketId` (both come from the route/ticket, Product rule 5). Extend `CreateInteractionDto` with `OmitType(CreateInteractionDto, ['ticketId'] as const)` from `@nestjs/swagger` so the validators are not restated — that keeps the two DTOs in step automatically.
- `ListTicketInteractionsQueryDto` — `channel?`, `direction?`, and `includeCustomerHistory?: boolean` (`@IsOptional() @IsBoolean()`; the global pipe's `enableImplicitConversion` turns `?includeCustomerHistory=true` into a real boolean).

**Create file: `apps/api/src/tickets/ticket-interactions.service.ts`**

Thin: it resolves the ticket, then delegates.

```ts
@Injectable()
export class TicketInteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  async list(
    ticketId: string,
    query: ListTicketInteractionsQueryDto,
  ): Promise<InteractionResponseDto[]> {
    const { customerId } = await this.resolve(ticketId);

    // includeCustomerHistory drops the ticketId filter, so the workspace can
    // show "everything we have ever said to this customer" with the entries for
    // THIS ticket identifiable by their non-null `ticket` ref.
    return this.interactionsService.list(customerId, {
      channel: query.channel,
      direction: query.direction,
      ticketId: query.includeCustomerHistory ? undefined : ticketId,
    });
  }

  async create(
    ticketId: string,
    dto: CreateTicketInteractionDto,
    caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    const { customerId } = await this.resolve(ticketId);

    return this.interactionsService.create(customerId, { ...dto, ticketId }, caller);
  }

  /** 404s on an unknown ticket before any child work, same contract as
   *  TicketCommentsService.list()'s assertExists call. */
  private async resolve(ticketId: string): Promise<{ id: string; customerId: string }> {
    await this.ticketsService.assertExists(ticketId);

    return this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { id: true, customerId: true },
    });
  }
}
```

Delegating to `InteractionsService.create` means the future-date guard, the cross-customer check (trivially satisfied), and the audit log all come for free and cannot drift between the two entry points.

**File: `apps/api/src/tickets/tickets.module.ts`** — add `TicketInteractionsController` to `controllers` (16–21) and `TicketInteractionsService` to `providers` (22–28). `CustomersModule` is already imported at line 15.

### 5 — The tasks module

**Create directory: `apps/api/src/tasks/`** with `tasks.module.ts`, `agent-tasks.controller.ts`, `agent-tasks.service.ts`, and `dto/agent-task.dto.ts`, `dto/create-agent-task.dto.ts`, `dto/update-agent-task.dto.ts`, `dto/set-agent-task-status.dto.ts`, `dto/list-agent-tasks-query.dto.ts`.

**`agent-tasks.service.ts`** — modelled on `ticket-comments.service.ts` plus `tickets.service.ts`'s list shape.

```ts
export const TASK_MANAGE_PERMISSION = 'tasks:manage';

/** The ONLY projection used for agent-task responses. */
const AGENT_TASK_SELECT = {
  id: true,
  title: true,
  notes: true,
  status: true,
  dueAt: true,
  remindAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assigneeId: true,
  assignee: { select: USER_REF_SELECT },
  createdBy: { select: USER_REF_SELECT },
  ticketId: true,
  ticket: { select: { id: true, subject: true } },
  customerId: true,
  customer: { select: CUSTOMER_REF_SELECT },
} satisfies Prisma.AgentTaskSelect;
```

`CUSTOMER_REF_SELECT` is module-private in `tickets.service.ts` (line 13). **Export it** from there and import it here rather than declaring a second copy — the same reasoning that made `USER_REF_SELECT` shared across three modules already.

Methods:

- `list(query, caller)` — `where` from: `scope` (`mine` → `assigneeId: caller.id`; `all` → no predicate, **requires `tasks:manage`** or throws `ForbiddenException`; `assigneeId` explicit → that user, also requiring `tasks:manage` unless it equals `caller.id`), `status?`, `ticketId?`, `customerId?`, `dueBefore?` (`dueAt: { lt }`), `overdueOnly?` (`dueAt: { lt: now }` **and** `status: { in: ['OPEN','IN_PROGRESS'] }`). Paginated exactly like `TicketsService.list()` — `$transaction([findMany, count])`, `orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }]`. **Do not** filter on `assignee.isActive` (Story 17 Edge Cases).
- `findOne(id, caller)` — `assertVisible`.
- `create(dto, caller)` — resolve `assigneeId` (`dto.assigneeId ?? caller.id`); if it is not `caller.id`, require `tasks:manage` (Product rule 10). Validate the ticket/customer links: `assertTicketExists`, `assertCustomerExists`, and **if both are given, that the ticket's `customerId` matches** (Story 17 Edge Cases flagged this as service-enforced). If only `ticketId` is given, **derive** `customerId` from the ticket so the task is reachable from the customer page too — document that derivation in a code comment, it is not obvious from the DTO.
- `update(id, dto, caller)` — `assertMutable` (author-or-assignee-or-`tasks:manage`, see below), then apply. Reject `assigneeId` changes to another user without `tasks:manage`.
- `setStatus(id, status, caller)` — `assertMutable`, then set `status` and apply Product rule 11: `completedAt = status === 'DONE' ? new Date() : null`.
- `remove(id, caller)` — `assertMutable`, hard delete, log.
- `assertVisible(id, caller)` — 404 if missing; `ForbiddenException` if `task.assigneeId !== caller.id && task.createdById !== caller.id && !caller.permissions.includes(TASK_MANAGE_PERMISSION)`.
- `assertMutable(id, caller)` — same predicate as `assertVisible`. Deliberately identical: a task's creator can still edit a task they delegated. Write that as a comment, not as two copies of the code — have `assertMutable` call `assertVisible`.

DTOs:

- `CreateAgentTaskDto` — `title` (`@IsString() @MinLength(2) @MaxLength(200)`), `notes?` (`@MaxLength(4000)`), `status?` (`@IsEnum(AgentTaskStatus)`), `dueAt?`/`remindAt?` (`@IsDateString()`, **no** future/past constraint — Product rule 12), `assigneeId?`, `ticketId?`, `customerId?` (all `@IsUUID()`).
- `UpdateAgentTaskDto` — every field optional; nullable fields (`notes`, `dueAt`, `remindAt`, `ticketId`, `customerId`) accept explicit `null` to clear. **Use the `dto.field !== undefined` presence test**, and copy the explanatory comment from `apps/api/src/tickets/dto/update-ticket.dto.ts` lines **41–52** — the `'field' in dto` trap is real in this codebase and this DTO has five nullable fields instead of one.
- `SetAgentTaskStatusDto` — one `@IsEnum(AgentTaskStatus)` field, modelled on `set-ticket-status.dto.ts`.
- `ListAgentTasksQueryDto extends PaginationQueryDto` — `scope: AgentTaskScope = AgentTaskScope.Mine`, `status?`, `assigneeId?`, `ticketId?`, `customerId?`, `dueBefore?` (`@IsDateString()`), `overdueOnly?` (`@IsBoolean()`).
- `AgentTaskResponseDto` / `PaginatedAgentTasksDto` — mirroring `ticket-response.dto.ts`, with `assignee: UserRefDto`, `createdBy: UserRefDto`, `ticket: InteractionTicketRefDto | null`, `customer: CustomerRefDto | null`, and a computed `isOverdue: boolean` matching Story 18's definition (`dueAt` past, status neither `DONE` nor `CANCELLED`).

**`agent-tasks.controller.ts`** at `@Controller('tasks')`, `@ApiTags('agent-tasks')`:

| Method | Route | Permission |
|---|---|---|
| `GET` | `/api/tasks` | `tasks:read` |
| `GET` | `/api/tasks/:id` | `tasks:read` |
| `POST` | `/api/tasks` | `tasks:write` |
| `PATCH` | `/api/tasks/:id` | `tasks:write` |
| `PATCH` | `/api/tasks/:id/status` | `tasks:write` |
| `DELETE` | `/api/tasks/:id` | `tasks:write` + `@HttpCode(HttpStatus.NO_CONTENT)` |

**`tasks.module.ts`** — `imports: [AuthModule, CustomersModule, TicketsModule]` (it needs `TicketsService.assertExists` and `CustomersService.assertExists`), one controller, one service.

### 6 — The quick-replies module

**Create directory: `apps/api/src/quick-replies/`** — `quick-replies.module.ts`, `quick-replies.controller.ts`, `quick-replies.service.ts`, `dto/quick-reply.dto.ts`.

- `QUICK_REPLY_SELECT` with `id`, `key`, `locale`, `title`, `body`, `channel`, `isActive`, `createdAt`, `updatedAt`, `createdBy: { select: USER_REF_SELECT }`.
- `list(query, caller)` — filters `locale?`, `channel?` (matching the channel **or** `null`, so channel-agnostic replies always appear: `OR: [{ channel: query.channel }, { channel: null }]`), and `includeInactive?`. `includeInactive` is honoured **only** if `caller.permissions.includes('quick-replies:write')`; otherwise forced to `isActive: true` (Product rule 13). Sorted `[{ key: 'asc' }, { locale: 'asc' }]`. Not paginated — the catalogue is small and the frontend loads it whole for a picker, same reasoning as `listAgents()`.
- `create(dto, caller)` — sets `createdById: caller.id`; catches Prisma `P2002` on `[key, locale]` and rethrows as `ConflictException('A quick reply with that key already exists for that locale.')`. `apps/api/src/customers/customers.service.ts` already has a `P2002` catch for the customer email unique — mirror its shape.
- `update(id, dto)` — `key` and `locale` are **immutable** (not in `UpdateQuickReplyDto`), matching `OrgService`'s "key is immutable" decision (`org.controller.ts` line 50).
- `remove(id)` — hard delete, `204`.
- Controller at `@Controller('quick-replies')`, `@ApiTags('quick-replies')`: `GET /` and `GET /:id` under `quick-replies:read`; `POST`, `PATCH /:id`, `DELETE /:id` under `quick-replies:write`.
- Module: `imports: [AuthModule]` only.

### 7 — Register everything

**File: `apps/api/src/app.module.ts`** — import and add `TasksModule` and `QuickRepliesModule` to the `imports` array (lines 54–61), after `DashboardModule`.

**File: `apps/api/src/main.ts`** — add to the `DocumentBuilder` chain (after line 55):

```ts
    .addTag('ticket-interactions', 'The communication timeline for one ticket')
    .addTag('communication', 'Communication channel metadata')
    .addTag('agent-tasks', 'Agent tasks and reminders')
    .addTag('quick-replies', 'Canned responses, per locale')
```

---

## Edge Cases & Failure Modes

- **`POST /api/customers/:id/interactions` with a `ticketId` belonging to another customer** → `400` "That ticket belongs to a different customer", from `assertTicketBelongsToCustomer` in task 3. **There is no database constraint** — if this check is skipped, the bug is silent and the data is unrecoverable without manual inspection.
- **`POST /api/customers/:id/interactions` with an unknown `ticketId`** → `400` "Unknown ticketId", not `404`: consistent with `assertCustomerExists`/`assertAgentExists` in `tickets.service.ts` (lines 250–278), which treat a bad body reference as a validation failure.
- **`POST /api/tickets/:ticketId/interactions` on an unknown ticket** → `404`, because `resolve()` calls `TicketsService.assertExists` first — the same contract every other nested ticket route has.
- **`POST /api/tickets/:ticketId/interactions` with `customerId` in the body** → `400` under `forbidNonWhitelisted`. The `OmitType` DTO does not declare it (Product rule 5).
- **`occurredAt` more than 5 minutes in the future**, on either route → `400`, via the reused `FIVE_MINUTES_MS` guard (`interactions.service.ts` lines 63–65). The ticket route inherits it by delegating rather than reimplementing.
- **`includeCustomerHistory=true` on a ticket with no interactions of its own** → returns the customer's other interactions, each with `ticket: null` or a ref to a *different* ticket. Story 21 must visually distinguish "this ticket" from "this customer" entries; the `ticket` ref is what makes that possible.
- **`includeCustomerHistory` sent as `1` or `yes`** → the global pipe's `enableImplicitConversion` coerces `'true'`/`'false'`; anything else fails `@IsBoolean()` with a `400`. Do not hand-roll string parsing.
- **A customer with hundreds of interactions and `includeCustomerHistory=true`** → the whole timeline is returned unpaginated. This is the pre-existing Story 11 contract (`GET /customers/:id/interactions` has never been paginated) and is **knowingly carried forward**; the `channel`/`direction` filters are the mitigation. Recorded here so it is not mistaken for an oversight.
- **A `support-agent` calling `GET /api/tasks?scope=all`** → `403`. They hold `tasks:read` but not `tasks:manage` (Product rule 9). This differs from `/api/tickets?scope=all`, which is open — the asymmetry is deliberate and documented in Product rule 9.
- **A `support-agent` calling `GET /api/tasks?assigneeId=<colleague>`** → `403`, same rule. `?assigneeId=<own id>` → `200`.
- **A `support-agent` creating a task with `assigneeId` set to a colleague** → `403`. With `assigneeId` absent → assigned to themselves.
- **A `support-agent` editing a task a supervisor created **for** them** → allowed: they are the assignee. Editing a task assigned to a colleague → `403`.
- **A task created with `ticketId` but no `customerId`** → `customerId` is derived from the ticket. A task created with **both**, mismatched → `400`. Neither is enforced by the database.
- **A task whose assignee is later deactivated** → still listed, still editable by a `tasks:manage` holder who can reassign it. `assignee.isActive` is **not** in any `where` clause (Story 17 Edge Cases).
- **Setting a task to `DONE` twice** → `completedAt` is overwritten with the later timestamp. Accepted; there is no "first completed at" requirement.
- **Setting a `DONE` task back to `OPEN`** → `completedAt` returns to `null` (Product rule 11). Missing this is the likeliest defect in `setStatus`.
- **Setting a task to `CANCELLED`** → `completedAt` stays/becomes `null`, not stamped.
- **`dueAt` in the past on create** → allowed, no warning (Product rule 12). `isOverdue` comes back `true` immediately, which is the intended way to record a missed commitment.
- **`GET /api/quick-replies?channel=SMS`** → returns SMS-specific replies **and** channel-agnostic ones (`channel: null`). Filtering with a bare `channel: 'SMS'` would hide every generic reply and make the picker look broken.
- **A `support-agent` passing `includeInactive=true`** → silently ignored, only active rows return. Not a `403`: the parameter is a hint, and failing the whole request over an ignorable flag is worse UX than honouring the permission quietly. Assert the silent-ignore in a test so it does not drift into a `403` later.
- **Creating a quick reply whose `[key, locale]` already exists** → `409` from the `P2002` catch, not a raw `500`.
- **Deleting a seeded quick reply** → succeeds, and the row **returns on the next `prisma:seed`** (Product rule 14). Retire with `isActive: false` instead.
- **`GET /api/communication/channels` returning eight items** → pin the count in a test. If Story 17's enum gains a value and the registry is not updated, TypeScript fails the build at `CHANNEL_REGISTRY` — but `CHANNEL_ORDER` is a plain array and would silently omit it, so the test guards the array.
- **A `customer`-role account on any route in this story** → `403`; that role holds no permissions at all (seed line 144).

---

## Test Plan

1. **`apps/api/src/customers/channel.registry.spec.ts`** (new, unit). `CHANNEL_REGISTRY` has an entry for every `Object.values(InteractionChannel)`; `CHANNEL_ORDER` has the same length and no duplicates; `providerConfigured` is `false` for every channel; `canRespond` is `false` for exactly `PHONE` and `MEETING`.
2. **`apps/api/src/customers/interactions.service.spec.ts`** (extend the existing file). Add: `list()` with no query keeps the original `where` (`{ customerId }` only) — **the backward-compatibility proof**; each of `channel`/`direction`/`ticketId` adds exactly its own predicate; `orderBy` still carries **both** keys; `create()` with a `ticketId` for a matching customer succeeds and passes `ticketId` into `data`; with a mismatched customer throws `BadRequestException`; with an unknown ticket throws `BadRequestException`; `toResponse` maps `ticketId` and the `ticket` ref, `null` when absent.
3. **`apps/api/src/tickets/ticket-interactions.service.spec.ts`** (new, unit). `list()` calls `assertExists` before any query; passes `ticketId` as a filter by default; passes `undefined` when `includeCustomerHistory` is true; forwards `channel`/`direction`. `create()` derives `customerId` from the ticket and injects `ticketId`, and delegates to `InteractionsService.create` (assert the mock was called with the composed dto — that is what proves the future-date guard is not bypassed).
4. **`apps/api/src/tasks/agent-tasks.service.spec.ts`** (new, unit). Modelled on `apps/api/src/tickets/tickets.service.spec.ts`. Cover: `scope=mine` predicate; `scope=all` without `tasks:manage` throws `ForbiddenException`, with it does not; `assigneeId` of another user without `tasks:manage` throws; `overdueOnly` composes `dueAt: { lt: now }` with the two active statuses; the `where` **never** references `assignee.isActive`; `create` defaults `assigneeId` to the caller; `create` for another user requires `tasks:manage`; `create` with `ticketId` only derives `customerId` from the ticket; `create` with a mismatched pair throws; `setStatus('DONE')` stamps `completedAt`; `setStatus('OPEN')` on a done task clears it to `null`; `setStatus('CANCELLED')` leaves it `null`; `update` with an explicit `null` on each nullable field clears it while an omitted key leaves it (the `!== undefined` proof, five fields); `assertVisible` allows assignee, allows creator, allows `tasks:manage`, throws otherwise; `remove` respects the same predicate; pagination meta matches `TicketsService.list()`'s shape.
5. **`apps/api/src/quick-replies/quick-replies.service.spec.ts`** (new, unit). `list` forces `isActive: true` without `quick-replies:write`; honours `includeInactive` with it; `channel` filter emits `OR: [{ channel }, { channel: null }]`; sort order; `create` maps `P2002` to `ConflictException`; `update` cannot change `key` or `locale` (assert they are absent from the `data` object even if present on the input object).
6. **`apps/api/test/tasks.e2e-spec.ts`** (new). Harness copied from `apps/api/test/tickets.e2e-spec.ts` lines 1–70. Cover the full CRUD as administrator; unauthenticated `401`; `customer`-role `403` on every route; a `support-agent` fixture: own-task CRUD `200`, `scope=all` `403`, `assigneeId=<colleague>` on list `403` and on create `403`, editing a colleague's task `403`, editing a task a supervisor assigned to them `200`; a `crm-manager` fixture creating a task for the agent then deleting it; status round-trip `OPEN → DONE → OPEN` asserting `completedAt` is stamped then `null`; `overdueOnly=true` returning a back-dated task and not a future one; `dueBefore` filtering; task creation with a `ticketId` returning a derived `customer` ref; task creation with mismatched `ticketId`/`customerId` → `400`; an unknown query key → `400`.
7. **`apps/api/test/quick-replies.e2e-spec.ts`** (new). Seeded catalogue is readable by a `support-agent`; `POST` as a `support-agent` → `403`; `POST` as administrator → `201`; duplicate `[key, locale]` → `409`; `PATCH` cannot change `key`; `DELETE` → `204`; `includeInactive=true` as a `support-agent` returns only active rows (**silent ignore, not 403**); `?channel=SMS` includes both the SMS reply and a `channel: null` reply.
8. **`apps/api/test/ticket-children.e2e-spec.ts`** (extend). Add the interactions family: `GET /api/tickets/:id/interactions` on an unknown ticket → `404`; `POST` then `GET` round-trip; the created interaction also appears in `GET /api/customers/:customerId/interactions` with a non-null `ticket` ref (**the linkage proof**); `includeCustomerHistory=true` returns an interaction logged directly against the customer with `ticket: null`; `POST` with `customerId` in the body → `400`; `POST` with a future `occurredAt` → `400`; `POST` as a `reporting-user` (no `interactions:write`) → `403`.
9. **`apps/api/test/customers.e2e-spec.ts`** or `customer-children.e2e-spec.ts` (extend). `GET /api/customers/:id/interactions` with **no** query params returns the same body it returned before this story (**the Story-11 contract proof**); `?channel=EMAIL` filters; `?ticketId=` filters; `?ticketId=<unknown uuid>` returns `[]`, not `404` (it is a filter, not a lookup); `POST` with a cross-customer `ticketId` → `400`. Also add: all eight channels are accepted on `POST`, including `WHATSAPP`, `SMS`, `WEB_FORM`.
10. **`apps/api/test/communication.e2e-spec.ts`** (new, small). `GET /api/communication/channels` returns exactly 8 items in `CHANNEL_ORDER`, every `providerConfigured` false; `403` for a `customer`-role account; `401` unauthenticated.
11. **Dashboard regression.** Re-run `apps/api/test/dashboard.e2e-spec.ts` (Story 18) with tasks now creatable, and add one case there: after creating two open tasks for the caller, `tasksDueSoon` has length 2 and is ordered by `dueAt` ascending with the undated one last.
12. **Every existing suite must pass unmodified.**

---

## Migration / Rollback

**No database migration.** Story 17 created every column this story reads.

**No breaking API change.** Every addition is additive:

- `CreateInteractionDto.ticketId` is optional; `InteractionResponseDto` gains two fields, and a frontend that ignores unknown response keys (Story 12's does) is unaffected.
- `GET /api/customers/:customerId/interactions` gains three optional query params; called with none, its response is byte-identical. Test 9 pins that.
- The three new route families are new paths.
- `CustomersModule.exports` widens, which cannot break a consumer.

**Rollback.** Delete `apps/api/src/tasks/`, `apps/api/src/quick-replies/`, `apps/api/src/tickets/ticket-interactions.*`, `apps/api/src/customers/channel*`; revert the two `interaction.dto.ts` additions, `interactions.service.ts`, `interactions.controller.ts`, both module files, `app.module.ts`, and `main.ts`. **Rows already written to `agent_tasks` and `customer_interactions.ticket_id` survive** and become unreachable rather than invalid — a later re-land picks them straight back up, and Story 18's dashboard keeps reading `agent_tasks` (its `tasksDueSoon` block does not depend on this story's module).

---

## Verification Steps

1. **Typecheck:** `npm run typecheck --workspace @crm/api`.
2. **Lint:** `npm run lint --workspace @crm/api`.
3. **Unit tests:** `npm run test --workspace @crm/api`.
4. **Backend builds:** `npm run build --workspace @crm/api`.
5. **E2E:** `npm run test:e2e --workspace @crm/api` — five new/extended suites plus every existing one.
6. **API starts:** `npm run dev:api`; no Nest resolution error. A missing `exports: [InteractionsService]` in `customers.module.ts` surfaces **here**, not at compile time — this is the single most likely startup failure in this story.
7. **Swagger:** `http://localhost:3000/api/docs` shows four new tags — **ticket-interactions**, **communication**, **agent-tasks**, **quick-replies** — and `POST /api/tickets/{ticketId}/interactions` shows a body with **no** `customerId` field.
8. **Manual timeline proof:** as the administrator, log an interaction on a customer with no `ticketId`, then log one via `POST /api/tickets/:id/interactions`. Confirm `GET /api/customers/:customerId/interactions` returns both, newest-occurred first, one with `ticket: null` and one with a populated `ticket`. Then confirm `GET /api/tickets/:id/interactions` returns only the second, and with `?includeCustomerHistory=true` returns both.
9. **Manual channel proof:** log one interaction per channel across all eight values, including `WHATSAPP`, `SMS`, `WEB_FORM`; confirm each round-trips with its channel intact and `GET /api/communication/channels` reports `canRespond` as specified in Product rule 3.
10. **Manual cross-customer proof:** attempt `POST /api/customers/<A>/interactions` with a `ticketId` belonging to customer B → `400` with the specific message.
11. **Manual task permission proof:** as a `support-agent` fixture — create a task (assigned to self), list it, complete it, re-open it and confirm `completedAt` is `null` again; then confirm `?scope=all` is `403` and creating a task for a colleague is `403`. As `crm-manager`, create a task for that agent and confirm the agent can edit it.
12. **Manual quick-reply proof:** as a `support-agent`, `GET /api/quick-replies?locale=ar` returns the seeded Arabic rows; `POST` → `403`. As administrator, deactivate one and confirm it disappears from the agent's list but is still visible with `includeInactive=true`.
13. **Regression:** confirm the customer detail page's data still loads — `GET /api/customers/:id`, `/notes`, `/attachments`, `/interactions` all `200` with unchanged shapes (plus the two new interaction fields).
14. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.

---

## Done Criteria

- [ ] `CHANNEL_REGISTRY` covers all eight `InteractionChannel` values, is typed `Record<InteractionChannel, …>`, and every `providerConfigured` is `false`; `GET /api/communication/channels` returns it in `CHANNEL_ORDER`.
- [ ] **No external provider client, SDK, SMTP transport, or webhook receiver was added anywhere** (Product rule 1) — verifiable by `apps/api/package.json` gaining no dependency in this story.
- [ ] `CustomerInteraction` responses carry `ticketId` and a `ticket` ref; `CreateInteractionDto` accepts an optional `ticketId`; a cross-customer `ticketId` is a `400`.
- [ ] `GET /api/customers/:customerId/interactions` accepts `channel`/`direction`/`ticketId` and is unchanged when called with none.
- [ ] `GET|POST /api/tickets/:ticketId/interactions` exist, gated on `tickets:read`/`interactions:write`, derive `customerId` from the ticket, and reject a body `customerId`.
- [ ] `includeCustomerHistory=true` widens the ticket timeline to the customer's whole history with the current ticket's entries identifiable by their `ticket` ref.
- [ ] Full task CRUD exists under `tasks:read`/`tasks:write`, with `tasks:manage` gating `scope=all`, cross-user listing, cross-user creation, and cross-user mutation.
- [ ] `completedAt` is stamped on `DONE` and cleared on any move out of `DONE`; `CANCELLED` never stamps it.
- [ ] Quick-reply CRUD exists; reads are `isActive`-filtered without `quick-replies:write`; `includeInactive` is silently ignored rather than rejected; `[key, locale]` collisions are `409`; `key`/`locale` are immutable.
- [ ] `InteractionsService` is exported from `CustomersModule`; no duplicate interaction-creation logic exists in `apps/api/src/tickets/`.
- [ ] `CUSTOMER_REF_SELECT` is exported and shared rather than re-declared.
- [ ] Four new Swagger tags; `TasksModule` and `QuickRepliesModule` registered in `app.module.ts`.
- [ ] No frontend file and no Prisma file was modified.
- [ ] All new and existing unit specs and e2e suites pass; full-repo typecheck/lint/test/build pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 20.**
