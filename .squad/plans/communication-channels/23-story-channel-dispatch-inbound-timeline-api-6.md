# Story 23 — Channel dispatch, inbound ingestion, and the unified timeline API (Story: 6)

## Prerequisites

- [Story 22 completed](22-story-communication-abstraction-data-model-6.md): `apps/api/src/communication/` exists with `ChannelRegistryService`, the eight adapters, and the moved `GET /api/communication/channels`; `CustomerInteraction` has its six delivery columns and a nullable `createdById`; `InteractionsService.create()` accepts a nullable caller and an optional delivery argument; `communication:send` is seeded; `COMMUNICATION_INBOUND_SECRET` is declared.
- The migration from Story 22 is applied and the seed has been re-run — check `npx prisma migrate status` before starting.
- PostgreSQL running; `npm run dev:api` starts cleanly.
- **No migration in this story.** Every column and enum value it writes was created in Story 22.
- **Almost no frontend change:** exactly one three-line null-guard, described in **Frontend Tasks**, and nothing else. Product rule 10 explains why it belongs here rather than in Story 24.

---

## Story Goal

Story 22 built the abstraction; this story exposes it. Four route families:

1. **Dispatch** — `POST /api/communication/messages` resolves the channel's adapter, validates through it, normalises the counterparty address, dispatches (which records, because no provider exists), and stores the result as an `OUTBOUND` interaction with its `deliveryStatus`, `channelAddress`, and `threadKey`. Gated on the new `communication:send`.
2. **Inbound ingestion** — `POST /api/communication/inbound/:channel` accepts a message from outside the application, matches it to a customer, and stores it as an `INBOUND` interaction with `deliveryStatus: RECEIVED` and **no author**. Machine-to-machine: `@Public()`, gated on a shared secret, idempotent on `(channel, externalId)`, and **503 when no secret is configured**.
3. **The unified timeline** — `GET /api/communication/timeline`, the cross-customer, **paginated** chronological feed the intake's "unified interaction timeline" acceptance criterion asks for. Filters on channel, direction, delivery status, customer, ticket, assigned agent, date range, and a text search.
4. **Conversations** — `GET /api/communication/conversations`, the timeline grouped by `(customer, channel, threadKey)` with the latest message and a count per group. This is what a conversation-list UI reads.

**Not in scope:** any migration. Any real transport — the dispatch route sends nothing, and the notice text saying so is Story 24's job to render. Any change to the four shipped interaction routes (`GET|POST /api/customers/:customerId/interactions`, `DELETE .../:id`, `GET|POST /api/tickets/:ticketId/interactions`) beyond what Story 22 already did. Any frontend file except the one null-guard. No new npm dependency.

---

## Context — Read These Files First

1. `apps/api/src/communication/channels/channel-adapter.ts` (created in Story 22) — the whole contract. `OutboundMessage`, `DispatchResult`, `InboundPayload`, `NormalisedInbound`, `ChannelCustomerContext`, `ChannelCapabilities`. The dispatch service calls `validate` → `resolveAddress` → `resolveSubject` → `threadKey` → `dispatch`, **in that order**; the order matters because `validate` must be able to reject an over-long body before an address is needed.
2. `apps/api/src/communication/channel-registry.service.ts` (created in Story 22) — `resolve(channel)` and `CHANNEL_ORDER`. `resolve` is the only way to reach an adapter; do not import an adapter class directly in a service.
3. `apps/api/src/customers/interactions.service.ts` — the widened `create()` and the `InteractionDelivery` interface from Story 22 task 11. **This is the only write path.** The new dispatch and inbound services must call it, not `prisma.customerInteraction.create` — that is what keeps the future-`occurredAt` guard (**77–79**) and the ticket-belongs-to-customer guard (**133–146**) in force on every path. Also read `INTERACTION_SELECT` and `list()` (**45–66**) — the unified timeline needs the same projection and a *different* pagination story.
4. `apps/api/src/tickets/ticket-interactions.service.ts` — full file (56 lines). The precedent for a service that resolves a parent and then delegates to `InteractionsService`: `list()` (**20–34**), `create()` (**36–44**), `resolve()` (**48–55**) with its `assertExists`-then-`findUniqueOrThrow` pair. The dispatch service does the same for a customer.
5. `apps/api/src/tickets/ticket-interactions.controller.ts` — full file (67 lines). The controller shape to copy: `@ApiTags`, `@ApiBearerAuth`, class-level `@ApiUnauthorizedResponse`/`@ApiForbiddenResponse`, `@RequirePermissions` per method, `@Param(..., ParseUUIDPipe)`.
6. `apps/api/src/tasks/agent-tasks.service.ts` — `list()` at **55–109**. The exact paginated-list shape the unified timeline copies: build `where` incrementally, then `this.prisma.$transaction([findMany({ skip, take }), count({ where })])` at **89–98**, then the `meta` object at **101–108** with `totalPages: Math.max(1, Math.ceil(total / query.pageSize))`. Also `TASK_MANAGE_PERMISSION` (**18**) as the "a permission constant lives next to the service that enforces it" convention.
7. `apps/api/src/common/dto/pagination.dto.ts` — full file (34 lines). `PaginationQueryDto` (**7–20**) with its `page`/`pageSize` initialisers, `PaginationMetaDto` (**22–34**), `DEFAULT_PAGE_SIZE` and `MAX_PAGE_SIZE` (**4–5**). The timeline query DTO extends `PaginationQueryDto`.
8. `apps/api/src/customers/dto/list-interactions-query.dto.ts` — full file (28 lines, plus the `deliveryStatus` field Story 22 added). The three-filter shape the timeline DTO extends, and the "not paginated" comment (**5–9**) that explains why the *new* route is different.
9. `apps/api/src/auth/decorators/public.decorator.ts` — full file (6 lines). `IS_PUBLIC_KEY` (**3**), `Public()` (**6**).
10. `apps/api/src/auth/guards/jwt-auth.guard.ts` **lines 27–31** — how `IS_PUBLIC_KEY` short-circuits the guard. `apps/api/src/auth/guards/permissions.guard.ts` **lines 13–20** does the same, which is why a `@Public()` route needs **no** `@RequirePermissions` and gets none.
11. `apps/api/src/health/health.controller.ts` **line 13** — the only `@Public()` route outside `auth.controller.ts` (**46, 70, 96**), and therefore the precedent for a public route in a feature module.
12. `apps/api/src/customers/customers.service.ts` — `assertExists` (**277**) returning `{ id, status }`, and `USER_REF_SELECT` (**20–24**). Grep for `CustomerStatus` in that file: the dispatch service needs to decide what to do about an `ARCHIVED` customer (Product rule 7).
13. `apps/api/src/tickets/tickets.service.ts` — `CUSTOMER_REF_SELECT` (**22–27**) and the public `assertExists` (**325–333**).
14. `apps/api/src/common/filters/all-exceptions.filter.ts` — the shape of the error body every thrown `HttpException` becomes. The inbound route's 401/503 responses go through it, so no custom error formatting is needed.
15. `apps/api/src/main.ts` **lines 42–63** — the Swagger tag list. Task 8 adds one tag.
16. `apps/api/test/communication.e2e-spec.ts` — full file (129 lines). The bootstrap block (**45–92**) is what the new e2e tests reuse verbatim; note it re-creates the app with the same global pipe/filter configuration as `main.ts`, and cleans up `@e2e.local` users in `afterAll` (**88–92**).
17. `apps/api/test/ticket-children.e2e-spec.ts` and `apps/api/test/customer-children.e2e-spec.ts` — the two nested-route e2e templates, including how they create a customer and a ticket fixture before exercising a child route.
18. [`.squad/plans/agent-dashboard-and-collaboration-and-enhancement-ui/19-story-tasks-quick-replies-communication-api-5.md`](../agent-dashboard-and-collaboration-and-enhancement-ui/19-story-tasks-quick-replies-communication-api-5.md) — the precedent for adding a route family to this API: one service per concern, permission key per write action, `assertExists` on the parent before touching a child.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **Dispatch is a separate route from logging.** `POST /api/communication/messages` (gated `communication:send`) exists alongside, not instead of, `POST /api/customers/:customerId/interactions` and `POST /api/tickets/:ticketId/interactions` (both gated `interactions:write`). Neither existing route's behaviour changes. | They are different acts. Logging records something that already happened, in the past, with no address and no validation beyond the column limits. Dispatching addresses a customer on a channel, runs that channel's rules, and — the day a provider exists — contacts them. Folding the two together would either impose email-address validation on "phoned the customer, no answer", or hand every `interactions:write` holder a send button. |
| 2 | **Dispatch still sends nothing.** It calls `adapter.dispatch()`, which returns `LOGGED` for every shipped adapter (Story 22 Product rule 5). The response carries `deliveryStatus: 'LOGGED'` so the client can say so out loud. | Unchanged from work item 5. The value of the route is not that it sends; it is that the validation, addressing, threading, and permission boundary are in place and tested, so adding a transport later is one adapter override. |
| 3 | **`direction` is not a client input on either new write route.** Dispatch always writes `OUTBOUND`; ingestion always writes `INBOUND`. | The route *is* the direction. Accepting the field would allow `POST /messages` with `direction: INBOUND`, which claims the customer sent something the agent typed. |
| 4 | **Ingestion is authenticated by a shared secret in `x-communication-secret`, compared with `crypto.timingSafeEqual`, and returns 503 when `COMMUNICATION_INBOUND_SECRET` is unset.** | A webhook has no user session, so `@Public()` is unavoidable — which makes the secret the entire boundary. `timingSafeEqual` because a `!==` on a secret is a timing oracle. 503-when-unset fails **closed**: a deployment that has not opted in has no unauthenticated write path at all, which is the safe default for the only public write route in the API. |
| 5 | **Ingestion is idempotent on `(channel, externalId)`.** A repeat delivery returns **200** with the already-stored interaction; a first delivery returns **201**. A payload with no `externalId` is never deduplicated. | Every webhook sender retries. Without this, one flaky network hop puts the same customer message in the timeline twice. The `@@unique([channel, externalId])` index from Story 22 makes it a lookup, not a scan. No `externalId` means the sender gave us nothing to deduplicate *on* — silently guessing (by body hash, say) would merge two genuinely identical messages sent a minute apart. |
| 6 | **Ingestion resolves the customer from `customerId` when given, otherwise by exact match on the normalised address against `Customer.email` or `Customer.phone`; an unresolvable address is a `404`.** | A webhook needs a machine-readable signal that the message was not filed, and 404 is it. The alternative — parking unmatched messages in a holding table — is a triage feature with its own UI, and nothing in this work item asks for one. Recorded in Deliberate exclusions. |
| 7 | **Dispatch to an `ARCHIVED` customer is a `400`; ingestion for one still stores.** | Sending a new message to an archived customer is almost certainly a mistake and is cheap to prevent. Refusing to *record* one they sent us would lose data — and an inbound message is often exactly the reason to un-archive. |
| 8 | **The unified timeline is paginated; the two per-customer/per-ticket timelines stay unpaginated.** | Work item 3 chose not to paginate one customer's history, and work item 5 recorded that choice; changing it now would break `CustomerDetailView.vue` and `CommunicationTimeline.vue`. A feed across *every* customer has no natural bound at all, so it must be paginated from the first commit. The asymmetry is deliberate, and the existing DTO's "not paginated" comment (**5–9**) is what records it. |
| 9 | **The unified timeline and conversations read under `customers:read`.** No new read permission. | `customers:read` already permits `GET /api/customers` — the full customer list — so it already permits reading those customers' conversations. A second read key would gate nothing that is not already open, and would need adding to five seeded roles to avoid breaking them. |
| 10 | **One frontend edit lands in this story:** a null-guard on `interaction.createdBy` in `CommunicationTimeline.vue` and `CustomerDetailView.vue`, plus the type change in `apps/web/src/api/customers.ts`. | Story 22 made `createdBy` nullable in the DTO but nothing could produce a null; **this** story ships the route that can. Deferring the guard to Story 24 would mean a window where one ingested message renders `Cannot read properties of null` in two shipped screens. The story that introduces the null fixes the null. |
| 11 | **`GET /api/communication/conversations` groups on `(customerId, channel, threadKey)` and every pre-Story-22 row lands in the `threadKey: null` bucket for its channel.** | Story 22 Product rule 7. Those rows never recorded an address, so there is nothing to derive a key from. One "earlier history" conversation per customer per channel is an honest representation of what is known. |
| 12 | **Conversation groups are ordered by `lastOccurredAt` descending, and a group's representative row is the newest by `occurredAt`, ties broken by taking the first row the second query returns.** | The tie is real but degenerate: two messages in one conversation at the identical millisecond. Picking deterministically-but-arbitrarily beats a raw SQL window function for a preview line. Documented in Edge Cases rather than engineered around. |
| 13 | **`search` matches `subject` OR `body`, case-insensitively, with `contains`.** No full-text index, no ranking. | `ILIKE '%term%'` on a subject/body pair is what the existing customer and ticket list filters already do; matching them keeps one search idiom in the API. A tsvector column would be a migration this story does not have. |

---

## Backend Tasks

### 1 — DTOs

**Create file: `apps/api/src/communication/dto/send-message.dto.ts`**

```ts
export class SendMessageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Ticket to attribute the message to. MUST belong to the same customer — ' +
      'a mismatch is a 400, enforced by InteractionsService.',
  })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiProperty({ enum: InteractionChannel })
  @IsEnum(InteractionChannel)
  channel!: InteractionChannel;

  @ApiPropertyOptional({
    maxLength: 160,
    description:
      'Ignored by channels whose capabilities report supportsSubject: false — ' +
      'those synthesise a subject from the body.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 8000,
    description:
      'Required, unlike CreateInteractionDto.body: you can log a call with no ' +
      'body, but you cannot send an empty message. Per-channel limits are ' +
      'tighter — see maxBodyLength on GET /api/communication/channels.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional({
    description:
      'Counterparty address. Defaults to the customer’s email or phone ' +
      'depending on the channel’s addressKind.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  address?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Defaults to now. Not more than 5 minutes in the future.',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
```

There is **no `direction` field** (Product rule 3). `320` is the RFC-5321 maximum length of an email address and comfortably covers a phone number or a session id.

**Create file: `apps/api/src/communication/dto/inbound-message.dto.ts`**

```ts
export class InboundMessageDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'When known, the customer this message belongs to. Otherwise the address ' +
      'is matched against Customer.email and Customer.phone.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({ maxLength: 320 })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  address?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @ApiProperty({ minLength: 1, maxLength: 8000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'The sender’s own message id. Supplying it makes the delivery idempotent ' +
      '(a repeat returns 200 with the stored row); omitting it does not.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Raw provider payload, stored for diagnosis and never returned.',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
```

`metadata` is the one place `forbidNonWhitelisted` (see `main.ts` **27–34**) needs care: a nested object passes because `@IsObject()` accepts it wholesale and no nested DTO is declared. Confirm this by test (Test Plan item 6) — the global pipe rejects unknown *top-level* keys, and that is the intended behaviour for a webhook body.

**Create file: `apps/api/src/communication/dto/list-timeline-query.dto.ts`**

```ts
/**
 * Paginated, unlike ListInteractionsQueryDto — this feed spans every customer
 * and has no natural bound (Product rule 8).
 */
export class ListTimelineQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InteractionChannel })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({ enum: InteractionDirection })
  @IsOptional()
  @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @ApiPropertyOptional({ enum: InteractionDeliveryStatus })
  @IsOptional()
  @IsEnum(InteractionDeliveryStatus)
  deliveryStatus?: InteractionDeliveryStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only interactions whose customer is assigned to this agent.',
  })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ description: 'Shorthand for assignedAgentId = the caller.', default: false })
  @IsOptional()
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredTo?: string;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Case-insensitive substring of subject or body.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ description: 'Only interactions attributed to a ticket.' })
  @IsOptional()
  @IsBoolean()
  ticketLinkedOnly?: boolean;
}
```

`mine` is **not** a security scope — it is a filter, exactly as `TicketScope` is (work item 5's "scope is a filter, not a security boundary" decision). It is shorthand only; when both `mine` and `assignedAgentId` are present, `assignedAgentId` wins.

**Create file: `apps/api/src/communication/dto/timeline.dto.ts`**

```ts
export class PaginatedTimelineDto {
  @ApiProperty({ type: () => [InteractionResponseDto] })
  items!: InteractionResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

/** One conversation: a customer, a channel, and a thread. */
export class ConversationDto {
  @ApiProperty({ type: () => InteractionCustomerRefDto })
  customer!: InteractionCustomerRefDto;

  @ApiProperty({ enum: InteractionChannel })
  channel!: InteractionChannel;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Null for interactions logged before Story 22, which never recorded an ' +
      'address to derive a key from (Product rule 11).',
  })
  threadKey!: string | null;

  @ApiProperty({ example: 12 })
  messageCount!: number;

  @ApiProperty({ format: 'date-time' })
  lastOccurredAt!: string;

  @ApiProperty({ type: () => InteractionResponseDto })
  lastMessage!: InteractionResponseDto;
}

export class ConversationListDto {
  @ApiProperty({ type: () => [ConversationDto] })
  items!: ConversationDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
```

`ListConversationsQueryDto` extends `PaginationQueryDto` with `customerId`, `channel`, `assignedAgentId`, and `mine` — a strict subset of the timeline filters, because a filter that can only match *some* messages in a group (a text search, a direction) would produce a group whose `messageCount` disagrees with its own contents. State that in a DTO doc comment.

### 2 — `Create file: apps/api/src/communication/communication.service.ts`

```ts
export const COMMUNICATION_SEND_PERMISSION = 'communication:send';

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelRegistryService,
    private readonly interactions: InteractionsService,
  ) {}

  async send(dto: SendMessageDto, caller: AuthenticatedUser): Promise<InteractionResponseDto> {
    const adapter = this.registry.resolve(dto.channel);

    if (!adapter.capabilities.canRespond) {
      throw new BadRequestException(`The ${dto.channel} channel cannot send.`);
    }

    const customer = await this.customerContext(dto.customerId);

    const message: OutboundMessage = {
      subject: dto.subject,
      body: dto.body,
      address: dto.address,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      ticketId: dto.ticketId,
    };

    // Order matters: validate can reject an over-long body before an address is
    // needed, which produces the more useful of the two 400s.
    adapter.validate(message);

    const address = adapter.resolveAddress(message, customer);
    const subject = adapter.resolveSubject(message);
    const threadKey = adapter.threadKey(address, dto.ticketId);
    const result = await adapter.dispatch(message, address);

    // Through InteractionsService, never prisma directly: that is what keeps the
    // future-occurredAt and ticket-belongs-to-customer guards on this path too.
    const interaction = await this.interactions.create(
      dto.customerId,
      {
        channel: dto.channel,
        direction: InteractionDirection.OUTBOUND,
        subject,
        body: dto.body.trim(),
        occurredAt: message.occurredAt.toISOString(),
        ticketId: dto.ticketId,
      },
      caller,
      {
        deliveryStatus: result.status,
        channelAddress: address,
        externalId: result.externalId,
        failureReason: result.failureReason,
        threadKey,
        metadata: result.metadata,
      },
    );

    this.logger.log(
      {
        actorId: caller.id,
        customerId: dto.customerId,
        channel: dto.channel,
        deliveryStatus: result.status,
        interactionId: interaction.id,
      },
      'Message dispatched',
    );

    return interaction;
  }
```

`customerContext(customerId)` reads `{ id, email, phone, status }` with `findUnique`, throws `NotFoundException('Customer not found.')` when absent, and throws `BadRequestException('That customer is archived.')` when `status === CustomerStatus.ARCHIVED` (Product rule 7). It returns a `ChannelCustomerContext`.

Note the `subject` handed to `create()` is the **adapter-resolved** one, so a channel with `supportsSubject: false` still satisfies the NOT NULL column, and `CreateInteractionDto`'s `@MinLength(2)` is satisfied by `resolveSubject`'s fallback to the channel name.

Then, on the same service, the ingestion method:

```ts
  async ingest(
    channel: InteractionChannel,
    dto: InboundMessageDto,
  ): Promise<{ interaction: InteractionResponseDto; created: boolean }> {
    const adapter = this.registry.resolve(channel);

    if (!adapter.capabilities.acceptsInbound) {
      throw new BadRequestException(`The ${channel} channel does not accept inbound messages.`);
    }

    const normalised = adapter.parseInbound({
      address: dto.address,
      subject: dto.subject,
      body: dto.body,
      externalId: dto.externalId,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
    });

    // Product rule 5. Checked before the customer lookup so a retry costs one
    // indexed read and nothing else.
    if (normalised.externalId) {
      const existing = await this.prisma.customerInteraction.findUnique({
        where: { channel_externalId: { channel, externalId: normalised.externalId } },
        select: { id: true, customerId: true },
      });

      if (existing) {
        this.logger.log({ channel, externalId: normalised.externalId }, 'Duplicate inbound ignored');

        return { interaction: await this.interactions.findOne(existing.customerId, existing.id), created: false };
      }
    }

    const customerId = await this.resolveInboundCustomer(channel, dto, normalised.address);
    ...
  }
```

Two things to get right here:

- **The compound-unique `where` key.** Prisma names it from the fields: `channel_externalId`. Confirm the generated name in `node_modules/.prisma/client/index.d.ts` after `prisma:generate` rather than assuming it — if the generated name differs, use the generated one.
- **`InteractionsService.findOne(customerId, id)` does not exist yet.** Add it: a `findFirst({ where: { id, customerId }, select: INTERACTION_SELECT })` that throws `NotFoundException` when absent, mirroring `remove()`'s lookup at **108–115**. It is three lines and it means the idempotent 200 returns the same body shape as the 201.

`resolveInboundCustomer(channel, dto, address)`:
- `dto.customerId` present → `customersService.assertExists(dto.customerId)`, return it. An explicit id is trusted over an address.
- else, `address` null → `BadRequestException('Either customerId or address is required.')`.
- else → match on the channel's `addressKind`: `'email'` → `findFirst({ where: { email: address } })`; `'phone'` → `findFirst({ where: { OR: [{ phone: address }, { alternatePhone: address }] } })`; `'session'` → no customer record holds a session id, so a `CHAT` ingestion **must** supply `customerId` — throw `BadRequestException('A CHAT message must supply customerId.')`.
- no match → `NotFoundException('No customer matches that address.')` (Product rule 6).

Then persist via `this.interactions.create(customerId, {...}, null, { deliveryStatus: InteractionDeliveryStatus.RECEIVED, channelAddress: normalised.address, externalId: normalised.externalId, failureReason: null, threadKey: adapter.threadKey(normalised.address, dto.ticketId), metadata: normalised.metadata })` and return `{ interaction, created: true }`.

Note `caller` is `null` — that is the whole reason Story 22 made `createdById` nullable.

### 3 — `Create file: apps/api/src/communication/timeline.service.ts`

`list(query, caller)` builds `where` incrementally, then paginates exactly as `AgentTasksService.list()` does at **89–108**:

```ts
    const where: Prisma.CustomerInteractionWhereInput = {};

    if (query.channel) where.channel = query.channel;
    if (query.direction) where.direction = query.direction;
    if (query.deliveryStatus) where.deliveryStatus = query.deliveryStatus;
    if (query.customerId) where.customerId = query.customerId;
    if (query.ticketId) where.ticketId = query.ticketId;
    if (query.ticketLinkedOnly) where.ticketId = { not: null };

    // An explicit assignedAgentId wins over `mine` — same precedence as
    // AgentTasksService.list() (agent-tasks.service.ts lines 63–75).
    const agentId = query.assignedAgentId ?? (query.mine ? caller.id : undefined);

    if (agentId) where.customer = { assignedAgentId: agentId };

    if (query.occurredFrom || query.occurredTo) {
      where.occurredAt = {
        ...(query.occurredFrom ? { gte: new Date(query.occurredFrom) } : {}),
        ...(query.occurredTo ? { lte: new Date(query.occurredTo) } : {}),
      };
    }

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerInteraction.findMany({
        where,
        select: INTERACTION_SELECT,
        // The same two keys as the per-customer timeline: occurredAt is
        // agent-supplied and can tie, so createdAt is the tiebreak that makes
        // pagination stable across pages.
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customerInteraction.count({ where }),
    ]);
```

`INTERACTION_SELECT` is `private` in `interactions.service.ts` today (**17–30**, no `export`). **Export it** and reuse it here — do not duplicate the projection. The `toResponse` mapper is a `private static` (**148**); make it a public static too, or expose a small `InteractionsService.toResponseList(rows)`. Reusing the mapper is what stops the two timelines drifting in shape.

`ticketLinkedOnly` combined with an explicit `ticketId` — the second assignment overwrites the first, which is correct (a specific ticket is narrower than "any ticket"), but write the two `if`s in the order above so it reads that way deliberately.

`conversations(query, caller)`:

```ts
    const where = /* the subset: customerId, channel, assignedAgentId/mine */;

    const groups = await this.prisma.customerInteraction.groupBy({
      by: ['customerId', 'channel', 'threadKey'],
      where,
      _count: { _all: true },
      _max: { occurredAt: true },
      orderBy: { _max: { occurredAt: 'desc' } },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    if (groups.length === 0) {
      return { items: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 1 } };
    }

    // One follow-up read for the representative rows. Prisma cannot return the
    // newest row per group from groupBy, and a raw window function would be the
    // only raw SQL in this API — not worth it for a preview line.
    const rows = await this.prisma.customerInteraction.findMany({
      where: {
        OR: groups.map((group) => ({
          customerId: group.customerId,
          channel: group.channel,
          threadKey: group.threadKey,
          occurredAt: group._max.occurredAt as Date,
        })),
      },
      select: INTERACTION_SELECT,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
```

Then match each group to the **first** row in `rows` with the same three keys (Product rule 12) and build the `ConversationDto`. A group whose representative row is missing — impossible unless a row was deleted between the two queries — is **skipped**, not returned with a null `lastMessage`; log a warning when it happens.

The **total** group count needs its own read: `groupBy` with no `skip`/`take` returning only `by` and then `.length`, or a `$queryRaw` count-distinct. Use the former and cap the concern in a comment: it reads one row per conversation, which is bounded by the number of distinct threads, not by message volume.

Note `threadKey: null` matches correctly in the `OR` — Prisma emits `IS NULL` for an explicit `null` in a `where`, which is exactly the Product-rule-11 bucket.

### 4 — `Create file: apps/api/src/communication/guards/inbound-secret.guard.ts`

```ts
const HEADER = 'x-communication-secret';

/**
 * The entire authentication boundary for the only public write route in this
 * API. @Public() removes the JWT guard, so this guard is what stands between
 * the internet and a row in customer_interactions.
 */
@Injectable()
export class InboundSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.config.get('COMMUNICATION_INBOUND_SECRET', { infer: true });

    if (!configured) {
      // Fail CLOSED (Product rule 4): a deployment that has not opted in has no
      // unauthenticated write path, and says so distinctly from "wrong secret".
      throw new ServiceUnavailableException('Inbound ingestion is not configured.');
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const presented = request.headers[HEADER];

    if (typeof presented !== 'string' || !InboundSecretGuard.matches(presented, configured)) {
      throw new UnauthorizedException('Invalid or missing inbound secret.');
    }

    return true;
  }

  private static matches(presented: string, configured: string): boolean {
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(configured, 'utf8');

    // timingSafeEqual throws on a length mismatch, so compare lengths first —
    // and note that leaks the secret's LENGTH, which is acceptable; leaking a
    // per-character comparison time would not be.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
```

`timingSafeEqual` comes from `node:crypto` — already a Node built-in, no dependency. `randomUUID` from the same module is already imported in `app.module.ts` **1**, so the import style is established.

### 5 — Controllers

**Create file: `apps/api/src/communication/communication.controller.ts`**

```ts
@ApiTags('communication')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('communication')
export class CommunicationController {
  constructor(
    private readonly communication: CommunicationService,
    private readonly timeline: TimelineService,
  ) {}

  @Post('messages')
  @RequirePermissions(COMMUNICATION_SEND_PERMISSION)
  @ApiOperation({
    summary: 'Send a message through a communication channel',
    description:
      'Resolves the channel’s adapter, validates and addresses the message ' +
      'through it, then records the result as an OUTBOUND interaction. NO ' +
      'external message is sent: every channel reports providerConfigured ' +
      'false, so the response carries deliveryStatus LOGGED.',
  })
  @ApiCreatedResponse({ type: InteractionResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, the channel cannot send, no address could be ' +
      'resolved, the customer is archived, or the ticket belongs to a ' +
      'different customer.',
  })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  send(
    @Body() dto: SendMessageDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> { ... }

  @Get('timeline')
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'The unified interaction timeline across every customer, newest-occurred first',
    description:
      'Paginated, unlike the per-customer and per-ticket timelines — this feed ' +
      'has no natural bound.',
  })
  @ApiOkResponse({ type: PaginatedTimelineDto })
  list(...)

  @Get('conversations')
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'The timeline grouped into conversations by customer, channel, and thread',
    description:
      'Interactions logged before the delivery columns existed have a null ' +
      'threadKey and group into one "earlier history" conversation per channel.',
  })
  @ApiOkResponse({ type: ConversationListDto })
  conversations(...)
}
```

**Create file: `apps/api/src/communication/inbound.controller.ts`**

```ts
@ApiTags('communication-inbound')
@Controller('communication/inbound')
@Public()
@UseGuards(InboundSecretGuard)
export class InboundController {
  constructor(private readonly communication: CommunicationService) {}

  @Post(':channel')
  @ApiOperation({
    summary: 'Ingest a message that arrived on a channel',
    description:
      'Machine-to-machine. Requires the x-communication-secret header matching ' +
      'COMMUNICATION_INBOUND_SECRET; 503 when that variable is unset. ' +
      'Idempotent on (channel, externalId): a repeat delivery returns 200 with ' +
      'the stored interaction instead of 201.',
  })
  @ApiHeader({ name: 'x-communication-secret', required: true })
  @ApiCreatedResponse({ type: InteractionResponseDto, description: 'Stored.' })
  @ApiOkResponse({ type: InteractionResponseDto, description: 'Already stored; nothing written.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing inbound secret.' })
  @ApiServiceUnavailableResponse({ description: 'COMMUNICATION_INBOUND_SECRET is not set.' })
  @ApiBadRequestResponse({
    description:
      'Validation failed, the channel does not accept inbound messages, or ' +
      'neither customerId nor a usable address was supplied.',
  })
  @ApiNotFoundResponse({ description: 'No customer matches that address.' })
  async ingest(
    @Param('channel', new ParseEnumPipe(InteractionChannel)) channel: InteractionChannel,
    @Body() dto: InboundMessageDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InteractionResponseDto> {
    const { interaction, created } = await this.communication.ingest(channel, dto);

    // 201 for a first delivery, 200 for a retry (Product rule 5). A fixed
    // @HttpCode cannot express both, so set it here.
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return interaction;
  }
}
```

`ParseEnumPipe` gives a 400 with the valid values listed for `POST /api/communication/inbound/CARRIER_PIGEON`, which is the right answer for a channel that does not exist. `@Res({ passthrough: true })` keeps Nest's serialisation while letting the status vary — verify the response body is still JSON-serialised (Test Plan item 7); a bare `@Res()` would break it.

**A separate controller, not a fourth method on `CommunicationController`.** The class-level `@Public()` and `@UseGuards` are the reason: putting them on one method of an otherwise bearer-authenticated controller invites someone to add a fifth method and inherit the public gate by accident.

### 6 — Module and Swagger wiring

**File: `apps/api/src/communication/communication.module.ts`** (created in Story 22) — add `CommunicationController` and `InboundController` to `controllers`, and `CommunicationService`, `TimelineService`, `InboundSecretGuard` to `providers`. `ConfigModule` is global (`app.module.ts` **20–25**), so `ConfigService` needs no import. `imports` is unchanged from Story 22.

**File: `apps/api/src/main.ts`** — add one tag after the existing `communication` entry (**58**):

```ts
    .addTag('communication-inbound', 'Machine-to-machine ingestion of messages that arrived on a channel')
```

### 7 — `InteractionsService` additions

**File: `apps/api/src/customers/interactions.service.ts`**

- **Export `INTERACTION_SELECT`** (**17**) so `TimelineService` reuses the one projection.
- Make the `toResponse` mapper (**148**) reachable from `TimelineService` — either `public static` or a new `static toResponseList(rows): InteractionResponseDto[]`.
- Add `findOne(customerId, id)`, mirroring `remove()`'s lookup (**108–115**) but selecting `INTERACTION_SELECT` and returning `toResponse`. Used by the idempotent-200 path.

No other change; the four shipped routes are untouched.

## Frontend Tasks

Exactly three edits, and nothing more (Product rule 10). This story is the first that can produce an interaction with no author, and two shipped screens dereference that field.

**File: `apps/web/src/api/customers.ts`** — in `CustomerInteraction` (**131–143**), change `createdBy: UserRef;` to:

```ts
  /** Null for a message ingested through POST /api/communication/inbound/:channel
   *  — no agent typed it. */
  createdBy: UserRef | null;
```

**File: `apps/web/src/components/CommunicationTimeline.vue`** — two places:
- `canDelete()` (**160–163**) reads `interaction.createdBy.id`. Change to `interaction.createdBy?.id === auth.user?.id`, and note that a null author therefore falls through to the `customers:archive` branch — matching the server rule from Story 22 task 11 exactly.
- the meta line (**287**) reads `interaction.createdBy.fullName`. Change to a computed label that falls back to a new translation key, e.g. `t('customer.detail.loggedBy', { name: interaction.createdBy?.fullName ?? t('communication.systemAuthor') })`.

**File: `apps/web/src/views/CustomerDetailView.vue`** — the same substitution at **391**.

Add `communication.systemAuthor` to **both** `apps/web/src/i18n/locales/en.json` (`"Received automatically"`) and `apps/web/src/i18n/locales/ar.json` (`"وارد تلقائيًا"`). `i18n.spec.ts`'s key-parity test (**34–42**) fails if only one is added.

**Do not** touch the timeline's data source, the composer, the filters, or any CSS. That is Story 24.

---

## Edge Cases & Failure Modes

- **`COMMUNICATION_INBOUND_SECRET` unset.** Every `POST /api/communication/inbound/:channel` returns **503** with `'Inbound ingestion is not configured.'`, distinct from the 401 a wrong secret gets. That distinction is deliberate: an operator debugging a webhook needs to know which of the two is wrong, and neither response reveals the secret.
- **A secret shorter than 32 characters in `.env`.** `validateEnv` (`env.validation.ts` **85–104**) refuses to boot, because Story 22 declared `@MinLength(32)`. Fail at startup, not on the first request.
- **A presented secret of a different length.** `timingSafeEqual` throws on mismatched buffer lengths, so `matches()` compares lengths first. This leaks the secret's *length* — acceptable, and noted in the code comment; leaking per-character comparison timing would not be.
- **A retried delivery with the same `externalId`.** Returns **200** and the stored row; nothing is written; the log line is `'Duplicate inbound ignored'`. A retry with the same `externalId` but a *different* body also returns the original row — the id is the identity, and quietly overwriting a stored customer message would be worse than ignoring a contradictory retry.
- **Two concurrent deliveries with the same `externalId`.** The pre-check is not transactional, so both can pass it and one `create` then violates `@@unique([channel, externalId])`. Catch `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'` around the create and fall back to the idempotent-200 path. Without this the second delivery gets a 500. **Implement it; do not treat it as unlikely** — webhook senders retry in bursts.
- **`CHAT` ingestion with no `customerId`.** `addressKind: 'session'` and no customer record holds a session id, so this is a `400` naming the field. Do **not** silently create an unattached interaction.
- **An address matching two customers.** `findFirst` takes the lowest-sorted row, arbitrarily. `Customer.email` has no unique constraint in this schema, so duplicates are possible. The mis-file is silent; log the interaction id, the channel, and the address at `warn` when the match is by address rather than by `customerId`, so it is at least traceable.
- **A phone match against `alternatePhone`.** Included in the `OR` deliberately: a customer who texts from their second number is the same customer. Note that the resulting `threadKey` uses the number they actually texted from, so their two numbers are two conversations. Correct, and worth knowing.
- **An `occurredAt` in the future on either new route.** Rejected by `InteractionsService.create()`'s existing five-minute guard (**77–79**), including on the inbound path. A webhook whose clock is ten minutes fast gets a 400; that is the right answer, and the 5-minute tolerance is what absorbs ordinary skew.
- **Dispatch to an archived customer** → 400. **Ingestion for an archived customer** → stored (Product rule 7).
- **`GET /api/communication/timeline?page=9999`.** Returns `items: []` with truthful `meta`, exactly as `AgentTasksService.list()` does. No 404 for an over-range page.
- **Pagination stability.** The two-key `orderBy` makes the order total *given a stable dataset*. A message ingested between page 1 and page 2 shifts rows across the boundary — inherent to offset pagination and consistent with every other list in this API. Do not add a cursor.
- **`search` with `%` or `_`.** Prisma parameterises `contains`, so these are matched literally, not as LIKE wildcards. Verify with a test rather than trusting it (Test Plan item 5).
- **`search` in Arabic.** `mode: 'insensitive'` maps to PostgreSQL `ILIKE`, which is a no-op for Arabic (the script is caseless) but still matches substrings correctly. No normalisation of alef variants (`أ`/`ا`) or diacritics — a documented limitation, not a bug.
- **A conversation group whose representative row is missing.** Only possible if a row is deleted between the `groupBy` and the `findMany`. Skip the group and log a warning; never return a `ConversationDto` with a null `lastMessage`, because the DTO says it is non-null.
- **Two messages in one conversation at the identical `occurredAt`.** Both match the `OR` clause; the first in the ordered result wins as the preview (Product rule 12). Deterministic per query, and only affects which of two same-instant messages is previewed.
- **A conversation page beyond the last group.** `groupBy` with `skip` past the end returns `[]`, and the early return produces `total: 0` — **wrong**, because the total is not zero. Compute `total` from the unpaginated group count **before** the early return, not after.
- **`forbidNonWhitelisted` and the webhook body.** The global pipe (`main.ts` **27–34**) 400s on an unknown top-level key, so a sender that adds `{"signature": "..."}` gets a 400 rather than having it ignored. That is strict but correct for a documented contract; senders put extra data in `metadata`. Assert it in a test so nobody later "fixes" it by loosening the global pipe.

---

## Test Plan

1. **Unit — `apps/api/src/communication/communication.service.spec.ts`** (new). Mock `PrismaService`, `ChannelRegistryService`, and `InteractionsService` as hand-rolled `jest.Mock` objects, following `interactions.service.spec.ts` **44–69**. Cover `send()`: rejects a channel with `canRespond: false`; rejects an archived customer with 400; 404s an unknown customer; calls the adapter in the order `validate` → `resolveAddress` → `resolveSubject` → `threadKey` → `dispatch`; passes the adapter's `threadKey`, `channelAddress`, and `deliveryStatus` into `InteractionsService.create`; always passes `direction: 'OUTBOUND'`; defaults `occurredAt` to now when absent.
2. **Unit — same file.** Cover `ingest()`: rejects a channel with `acceptsInbound: false`; returns `created: false` and does not call `create` when `(channel, externalId)` already exists; resolves the customer from `customerId` in preference to `address`; matches an email address, matches `phone` and `alternatePhone`; 404s an unmatched address; 400s a `CHAT` payload with no `customerId`; passes `caller: null` and `deliveryStatus: 'RECEIVED'`; converts a `P2002` from the create into the idempotent path rather than a 500.
3. **Unit — `apps/api/src/communication/guards/inbound-secret.guard.spec.ts`** (new). Throws `ServiceUnavailableException` when the config value is absent; `UnauthorizedException` when the header is missing, when it is the wrong length, and when it is the same length but wrong; returns `true` on an exact match. Use a stub `ConfigService` with a `get` mock.
4. **Unit — `apps/api/src/communication/timeline.service.spec.ts`** (new). Each filter lands in `where` as specified; `assignedAgentId` wins over `mine`; `mine` resolves to `caller.id`; `occurredFrom`/`occurredTo` produce `gte`/`lte` on one `occurredAt` object; `search` produces the two-branch `OR`; `ticketLinkedOnly` produces `{ not: null }`; `orderBy` is `[{ occurredAt: 'desc' }, { createdAt: 'desc' }]`; `skip`/`take` derive from `page`/`pageSize`; `totalPages` is `1` when `total` is `0`.
5. **Unit — same file.** `conversations()`: `total` is computed from the unpaginated group count even when the requested page is empty; a group whose representative row is absent is skipped rather than returned; a `threadKey: null` group is queried with an explicit `null`; `search` and `direction` are **not** accepted by `ListConversationsQueryDto`. Add one test that `search: 'a%b'` reaches Prisma as the literal string.
6. **E2E — `apps/api/test/communication.e2e-spec.ts`** (extend the existing file; keep all Story 22 assertions passing). Dispatch: `POST /api/communication/messages` with no token → 401; as a `reporting-user` → 403; as an admin with `channel: 'EMAIL'` against a customer with an email → 201, `direction: 'OUTBOUND'`, `deliveryStatus: 'LOGGED'`, `channelAddress` lower-cased, non-null `threadKey`; against a customer with **no** email → 400; with `channel: 'WEB_FORM'` → 400; with `channel: 'SMS'` and a 2000-character body → 400; with an unknown top-level key → 400 (the `forbidNonWhitelisted` assertion).
7. **E2E — `apps/api/test/communication-inbound.e2e-spec.ts`** (new). Requires `COMMUNICATION_INBOUND_SECRET` in the test environment; when it is absent the whole describe asserts **503** instead and is skipped otherwise — write both paths so the suite passes either way and says which it took. With the secret set: no header → 401; wrong header → 401; correct header and a body whose `address` is a fixture customer's email → 201 with `direction: 'INBOUND'`, `deliveryStatus: 'RECEIVED'`, and `createdBy: null`; the identical body again → **200** with the same `id`; an unmatched address → 404; `POST .../PHONE` → 400 (`acceptsInbound: false`); `POST .../NOT_A_CHANNEL` → 400 listing the valid values. Assert the 200 response body is JSON with the same shape as the 201 — that is the `@Res({ passthrough: true })` check.
8. **E2E — same/new file.** Timeline: `GET /api/communication/timeline` with no token → 401; as an admin → 200 with `items` and `meta`; `?pageSize=1` returns one item and `meta.total` greater than 1; `?channel=EMAIL` returns only EMAIL rows; `?search=<subject fragment>` finds the dispatched fixture; `?customerId=<other customer>` excludes it; `?page=9999` returns `items: []` with a truthful `meta`. Conversations: `GET /api/communication/conversations` returns a group whose `lastMessage.id` is the newest dispatched fixture and whose `messageCount` matches the number of fixtures in that thread.
9. **Frontend — `apps/web/src/components/CommunicationTimeline.spec.ts`** (modify). Add one interaction fixture with `createdBy: null` and assert the entry renders the `communication.systemAuthor` fallback and shows no Delete button for a caller holding `interactions:write` but not `customers:archive`. `apps/web/src/i18n/i18n.spec.ts` needs no new test — its existing key-parity test (**34–42**) covers the two new keys.

---

## Verification Steps

1. **Backend builds:** from `apps/api`, `npm run typecheck`, then `npm run build`. Both clean.
2. **Backend unit tests:** from `apps/api`, `npm test`. All pass.
3. **Frontend still builds:** from `apps/web`, `npm run typecheck` then `npm test`. Both clean — the three-line null-guard is the only change and its spec covers it.
4. **Boot and read the contract:** `npm run dev:api`, then open `http://localhost:3000/api/docs`. Confirm the `communication` tag lists `POST /communication/messages`, `GET /communication/timeline`, and `GET /communication/conversations`, and that `communication-inbound` lists `POST /communication/inbound/{channel}` with the `x-communication-secret` header documented and **no** bearer requirement.
5. **Dispatch by hand:** log in as the seeded admin, take a customer id with an email, and
   ```bash
   curl -X POST http://localhost:3000/api/communication/messages \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"customerId":"<id>","channel":"EMAIL","subject":"Following up","body":"We are on it."}'
   ```
   Expect 201, `deliveryStatus: "LOGGED"`, `channelAddress` equal to the customer's email in lower case, `threadKey` starting `EMAIL:`.
6. **Ingestion fails closed:** with `COMMUNICATION_INBOUND_SECRET` **absent** from `apps/api/.env`, `POST /api/communication/inbound/EMAIL` returns **503**. Then add a 32+ character secret, restart, and repeat with `-H "x-communication-secret: <secret>"` and an `address` matching that customer — expect 201, `createdBy: null`. Send the **same** body again — expect **200** and the same `id`.
7. **Regression:** the four shipped interaction routes behave exactly as before. Re-run `npm run test:e2e` from `apps/api` — `customer-children`, `ticket-children`, `customers`, `tickets`, `tasks`, `quick-replies`, and `dashboard` all pass unchanged.
8. **Regression, in the browser:** with both dev servers up, open a ticket workspace and a customer profile. The timeline renders, the Respond composer still logs, and the ingested message from step 6 appears in that customer's history showing "Received automatically" instead of an agent name.

---

## Done Criteria

- [ ] `POST /api/communication/messages` exists, is gated on `communication:send`, always writes `direction: OUTBOUND`, and returns `deliveryStatus: 'LOGGED'` with a resolved `channelAddress` and `threadKey`.
- [ ] Dispatch calls the adapter in the order `validate` → `resolveAddress` → `resolveSubject` → `threadKey` → `dispatch`, and persists **through `InteractionsService.create()`**, never through Prisma directly.
- [ ] Dispatch 400s a non-respondable channel, an unresolvable address, an archived customer, and an over-limit body for the channel; 404s an unknown customer.
- [ ] `POST /api/communication/inbound/:channel` exists, is `@Public()` with `InboundSecretGuard`, returns **503** when `COMMUNICATION_INBOUND_SECRET` is unset and **401** on a missing or wrong secret, and compares the secret with `crypto.timingSafeEqual`.
- [ ] Ingestion writes `direction: INBOUND`, `deliveryStatus: RECEIVED`, `createdById: null`; is idempotent on `(channel, externalId)` returning **200** on a repeat; and converts a concurrent `P2002` into that same idempotent path rather than a 500.
- [ ] Ingestion resolves the customer from `customerId`, else by exact match on `email` / `phone` / `alternatePhone`, 404s an unmatched address, and 400s a `CHAT` payload with no `customerId`.
- [ ] `GET /api/communication/timeline` is paginated, gated on `customers:read`, ordered `[occurredAt desc, createdAt desc]`, and supports all ten filters, with `assignedAgentId` taking precedence over `mine`.
- [ ] `GET /api/communication/conversations` groups on `(customerId, channel, threadKey)`, returns a correct `total` for an out-of-range page, and skips rather than nulls a group with no representative row.
- [ ] `INTERACTION_SELECT` is exported and reused by `TimelineService`; the response mapper is shared; `InteractionsService.findOne()` exists.
- [ ] The `communication-inbound` Swagger tag exists; the four shipped interaction routes are unchanged.
- [ ] Exactly three frontend edits landed: `CustomerInteraction.createdBy` is nullable in `apps/web/src/api/customers.ts`, and the two `createdBy` dereferences in `CommunicationTimeline.vue` and `CustomerDetailView.vue` are guarded with the new `communication.systemAuthor` key present in **both** locale files.
- [ ] **No migration** was created (`npx prisma migrate status` reports no new migration) and `apps/api/package.json` is unchanged.
- [ ] `npm run typecheck`, `npm test`, and `npm run test:e2e` pass in `apps/api`; `npm run typecheck` and `npm test` pass in `apps/web`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 24.**
