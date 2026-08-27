# Story 22 — Communication abstraction layer and channel delivery data model (Story: 6)

## Prerequisites

- [Story 19 completed](../agent-dashboard-and-collaboration-and-enhancement-ui/19-story-tasks-quick-replies-communication-api-5.md): `apps/api/src/customers/channel.registry.ts`, `channels.controller.ts`, `dto/channel.dto.ts`, `dto/list-interactions-query.dto.ts`, `CustomerInteraction.ticketId`, and `GET|POST /api/tickets/:ticketId/interactions` all exist and ship. **This story moves and replaces the first three of those.**
- [Story 17 completed](../agent-dashboard-and-collaboration-and-enhancement-ui/17-story-agent-workspace-data-model-5.md): the eight-value `InteractionChannel` enum (`apps/api/prisma/schema.prisma` lines 28–37) and the migration conventions this story follows.
- [Story 21 completed](../agent-dashboard-and-collaboration-and-enhancement-ui/21-story-frontend-agent-dashboard-workspace-5.md): `apps/web/src/components/CommunicationTimeline.vue` and `apps/web/src/api/communication.ts` consume `GET /api/communication/channels`. **Every field they read today must survive this story unchanged.**
- PostgreSQL running; `npm run dev:api` starts cleanly; the seeded administrator's password is known.
- **This story is the only story in this feature that creates a migration.** Stories 23 and 24 add none.
- **No frontend file changes in this story.** See Product rule 9.

---

## Story Goal

Work item 5 shipped `CustomerInteraction` as a place to *log* what an agent already did. Work item 6 asks for a **communication abstraction layer** with five named channels behind it. That layer needs three things the repo does not have:

1. **A per-channel contract.** One `ChannelAdapter` interface with an implementation per channel — Email, WhatsApp, Live Chat, SMS, Web Form, plus a log-only adapter covering Phone, Meeting, and Other. Each adapter owns its own address rules, body limits, subject handling, and conversation-thread derivation. Adding a ninth channel becomes "write one adapter and add it to one array", not "grep for eight `switch` statements".
2. **A delivery lifecycle on the stored interaction.** New columns — `deliveryStatus`, `channelAddress`, `externalId`, `failureReason`, `threadKey`, `metadata` — so an interaction records *how* it travelled, not just that it happened. `createdById` becomes **nullable** so an inbound message that no agent typed can be stored honestly.
3. **A single owner for channel metadata.** A new `apps/api/src/communication/` module takes over `GET /api/communication/channels` from `CustomersModule`, returning richer descriptors (additive fields only) resolved from the adapters themselves rather than from a hand-maintained constant.

**Not in scope:** any HTTP route other than the relocated `GET /api/communication/channels` — dispatch, inbound ingestion, and the unified timeline are Story 23. Any frontend file — Story 24. Any real transport: no SMTP client, no Twilio/WhatsApp SDK, no websocket, **no new npm dependency on the API side at all**. `providerConfigured` stays `false` for all eight channels, and every shipped adapter's `dispatch()` returns `LOGGED`.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `InteractionChannel` at **lines 28–37** (note the declaration order differs from display order: `PHONE, EMAIL, CHAT, MEETING, OTHER, WHATSAPP, SMS, WEB_FORM`), `InteractionDirection` at **39–42**, and `model CustomerInteraction` at **317–336**. Read the two `@@index` lines (**333–334**) and the `createdBy` relation at **330** — `onDelete: Restrict` on a non-nullable FK is what task 2 changes. Grep the whole file for `Json`: **there are no matches**, so `metadata Json?` in task 2 is the first JSON column in this schema.
2. `apps/api/prisma/migrations/20260826084752_agent_workspace_tasks_quick_replies/migration.sql` — the precedent for the exact SQL Prisma emits: the `AlterEnum` comment block for a multi-value enum addition, `CreateEnum`, `AlterTable ADD COLUMN`, `CreateIndex`, `AddForeignKey`. Task 3's migration must be Prisma-generated, not hand-written; this file is what "generated correctly" looks like.
3. `apps/api/src/customers/channel.registry.ts` — full file (80 lines). `ChannelDescriptor` (**14–19**), `CHANNEL_REGISTRY` (**21–68**), `CHANNEL_ORDER` (**71–80**). Every `canRespond` / `isRealtime` value here is carried forward into the adapters **except `WEB_FORM.canRespond`** — see Product rule 4.
4. `apps/api/src/customers/channel.registry.spec.ts` — full file (37 lines). The test at **29–37** asserts `canRespond` is false for *exactly* `PHONE` and `MEETING`. Product rule 4 changes that set, so this assertion changes with it. The exhaustiveness tests at **5–21** are the ones to reproduce against the new registry service.
5. `apps/api/src/customers/channels.controller.ts` — full file (32 lines). `@Controller('communication/channels')` at **19**, gated `customers:read` at **22**, `list()` at **32**. This file is **deleted**; the new controller keeps the same path, the same permission, and the same `{ items: [...] }` envelope.
6. `apps/api/src/customers/dto/channel.dto.ts` — full file (28 lines). `ChannelDescriptorDto` (**4–21**) and `ChannelListDto` (**25–28**). Moved and extended, never renamed.
7. `apps/api/src/customers/interactions.service.ts` — full file (163 lines). This is the single write path every route funnels through, and task 11 widens it:
   - `FIVE_MINUTES_MS` (**15**) and the future-`occurredAt` guard in `create()` (**77–79**) — reused verbatim, do **not** re-derive.
   - `INTERACTION_SELECT` (**17–30**) — gains the six new columns.
   - `create()` (**68–105**) — gains an optional delivery argument and a nullable `caller`.
   - `remove()` (**107–126**) — the author-or-`ARCHIVE_PERMISSION` rule at **117–121**. Note it reads `interaction.createdById !== caller.id`; a `null` author must not accidentally satisfy that comparison (Edge Cases).
   - `assertTicketBelongsToCustomer()` (**133–146**) — the Product-rule-4-of-Story-19 cross-table check.
   - `toResponse()` (**148–162**).
8. `apps/api/src/customers/dto/interaction.dto.ts` — full file (96 lines). `CreateInteractionDto` (**14–51**), `InteractionTicketRefDto` (**55–61**), `InteractionResponseDto` (**63–96**) with `createdBy!: UserRefDto` at **85–86**. Task 12 extends the response DTO and makes `createdBy` nullable.
9. `apps/api/src/customers/customers.module.ts` — full file (32 lines). `ChannelsController` is imported at **6** and listed at **21**; both lines are removed. `exports: [CustomersService, InteractionsService]` at **30** stays — the new module depends on it.
10. `apps/api/src/tickets/tickets.service.ts` **lines 17–27** — `TICKET_MANAGE_PERMISSION`, `TICKET_ASSIGN_PERMISSION`, and the exported `CUSTOMER_REF_SELECT` (**22–27**) that task 11 reuses for the interaction's customer ref. Also **325–333**, the public `assertExists`.
11. `apps/api/src/quick-replies/quick-replies.module.ts` — full file (11 lines). The smallest module in the repo and the shape `CommunicationModule` starts from. `apps/api/src/tasks/tasks.module.ts` (13 lines) shows the same shape with `imports: [AuthModule, CustomersModule, TicketsModule]`.
12. `apps/api/src/config/env.validation.ts` — full file (104 lines). `EnvironmentVariables` (**30–83**); `UPLOAD_DIR` / `MAX_UPLOAD_BYTES` (**72–82**) are the template for an optional-with-constraint variable. `validateEnv` (**85–104**) throws on the first invalid value — that is why task 13's variable must be `@IsOptional()`, or every existing `.env` breaks.
13. `apps/api/prisma/seed.ts` — the `permissions` array at **41–70** (28 keys; `interactions:write` at **57**, `quick-replies:write` at **68**, `tickets:assign` at **69**) and the four staff role arrays: `crm-manager` **83–112**, `support-supervisor` **118–139**, `support-agent` **145–161**, `reporting-user` **173–180**. `system-administrator` at **77** takes every key automatically via `permissions.map(...)`, so it needs no edit.
14. `apps/api/src/customers/interactions.service.spec.ts` **lines 1–70** — the unit-test shape: a `baseInteractionRow` literal (**13–26**) that must gain the new columns, a `buildCaller()` factory (**28–40**), and hand-rolled `jest.Mock` objects for `prisma` and `customersService` (**44–69**).
15. `apps/api/test/communication.e2e-spec.ts` — full file (129 lines). Bootstrap **45–92**; the three existing assertions **94–128**. The `items` length/order assertion at **104–114** and the `providerConfigured` assertion at **115–117** must still pass after this story.
16. [`.squad/plans/agent-dashboard-and-collaboration-and-enhancement-ui/17-story-agent-workspace-data-model-5.md`](../agent-dashboard-and-collaboration-and-enhancement-ui/17-story-agent-workspace-data-model-5.md) — the precedent for a migration-plus-seed story in this repo: one migration, permission keys added in the same story, no route changes.

---

## Product rules (from story)

| # | Current behaviour | New behaviour | Rationale |
|---|---|---|---|
| 1 | `CHANNEL_REGISTRY` is a hand-maintained `Record<InteractionChannel, ChannelDescriptor>` constant with four boolean fields. | Each channel is a **class implementing `ChannelAdapter`**, and the descriptor list is *derived* from the adapters by `ChannelRegistryService`. | The intake asks for a "communication abstraction layer" and five named channels. A constant cannot hold per-channel validation, address normalisation, or thread derivation — the three things that actually differ between email and SMS. Deriving the descriptors means the metadata endpoint can never disagree with the code that dispatches. |
| 2 | Nothing records how an interaction travelled. | `deliveryStatus`, `channelAddress`, `externalId`, `failureReason`, `threadKey`, `metadata`. | Without an address, an "email interaction" does not say which mailbox; without a thread key, the timeline cannot be grouped into conversations; without an external id, an inbound webhook cannot be made idempotent. All six are **nullable or defaulted**, so every existing row and every existing route stays valid. |
| 3 | `CustomerInteraction.createdById` is **non-nullable** with `onDelete: Restrict`. | **Nullable**, with `onDelete: SetNull`. `InteractionResponseDto.createdBy` becomes `UserRefDto \| null`. | Story 23 ingests inbound messages that no agent typed. The alternative — a seeded fake "system" user — puts a login-shaped row in `users` that exists only to be a foreign key, and makes every per-agent report count machine traffic as human work. `Ticket.createdById` is already `String?` with `SetNull` (schema line 352); this makes the two consistent. |
| 4 | `WEB_FORM.canRespond` is **`true`** (Story 19 Product rule 3 grouped it with the five channels the intake named). | `WEB_FORM.canRespond` is **`false`**, and `acceptsInbound` is `true`. | A web form is a one-way intake: there is no "reply through the form" — the reply goes out by email. Story 19 set it true because the intake listed five channels and it took the list literally. Work item 6 names Web Form as a channel to *receive* on. This is a **knowing behaviour correction**, not a regression: `channel.registry.spec.ts` **29–37** and the frontend's respondable-channel filter both change with it, and both changes are listed in the tasks below. |
| 5 | — | `providerConfigured` is `false` for all eight adapters, and every shipped `dispatch()` returns `deliveryStatus: LOGGED` with `externalId: null`. | Unchanged from work item 5's decision, and now **testable**: `channel-registry.service.spec.ts` asserts it for every adapter in one loop, so a future adapter that starts sending cannot do it silently. |
| 6 | — | `QUEUED`, `SENT`, and `FAILED` are declared on `InteractionDeliveryStatus` but **unreachable today**. | They are the seam Product rule 5 leaves open. Declaring them now means a future provider adds a transport, not a migration. The unreachability is asserted, not assumed — see Test Plan item 4. |
| 7 | — | `threadKey` is derived by the adapter, never supplied by a client, and is `null` for every pre-existing row. | A conversation key is a function of the channel and the counterparty address; letting a client set it would let two agents split one conversation in half. Pre-existing rows grouping under `threadKey: null` is a documented consequence, not a bug (Edge Cases). |
| 8 | — | Exactly **one** new permission key: `communication:send`. Reads stay on `customers:read`. | Dispatching *would* contact a customer once a provider exists; logging after the fact would not. That is a real privilege boundary and deserves its own key. A second *read* key would not: `customers:read` already permits listing every customer, so it already permits reading their conversations. |
| 9 | — | **No frontend file is touched in this story.** | `apps/web` mirrors the API contract in hand-written types (`apps/web/src/api/customers.ts` **131–143**); it does not import the API's DTOs, so a nullable `createdBy` in the DTO cannot break `vue-tsc`. And nothing can *produce* a null author until Story 23 ships ingestion — which is why Story 23, not this one, carries the frontend null-guard. |
| 10 | — | Exactly **one** new environment variable, `COMMUNICATION_INBOUND_SECRET`, and it is **optional**. | Story 23 needs it; declaring it here keeps all configuration surface in the one story that touches config. Optional because `validateEnv` (**85–104**) throws on the first missing required value, and every developer's existing `.env` must keep booting. |

---

## Backend Tasks

### 1 — The delivery-status enum

**File: `apps/api/prisma/schema.prisma`**

Add after `InteractionDirection` (line 42), keeping the file's convention of grouping enums at the top:

```prisma
/// How an interaction travelled, as distinct from whether it happened.
/// LOGGED and RECEIVED are the only values reachable today: no channel has an
/// external transport (ChannelAdapter.capabilities.providerConfigured is false
/// for all eight), so every outbound dispatch is recorded, not sent.
/// QUEUED/SENT/FAILED are the declared seam for a future provider.
enum InteractionDeliveryStatus {
  LOGGED
  RECEIVED
  QUEUED
  SENT
  FAILED
}
```

### 2 — `CustomerInteraction` gains its delivery columns

**File: `apps/api/prisma/schema.prisma`**, `model CustomerInteraction` (**317–336**)

```prisma
model CustomerInteraction {
  id             String                    @id @default(uuid()) @db.Uuid
  customerId     String                    @map("customer_id") @db.Uuid
  createdById    String?                   @map("created_by_id") @db.Uuid
  channel        InteractionChannel
  direction      InteractionDirection
  subject        String
  body           String?
  occurredAt     DateTime                  @map("occurred_at")
  createdAt      DateTime                  @default(now()) @map("created_at")
  ticketId       String?                   @map("ticket_id") @db.Uuid
  deliveryStatus InteractionDeliveryStatus @default(LOGGED) @map("delivery_status")
  channelAddress String?                   @map("channel_address")
  externalId     String?                   @map("external_id")
  failureReason  String?                   @map("failure_reason")
  threadKey      String?                   @map("thread_key")
  /// Raw provider payload echo, for diagnosing a delivery problem. NEVER read
  /// by application logic and NEVER projected into an API response.
  metadata       Json?

  customer  Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdBy User?    @relation("CustomerInteractionAuthor", fields: [createdById], references: [id], onDelete: SetNull)
  ticket    Ticket?  @relation(fields: [ticketId], references: [id], onDelete: SetNull)

  @@unique([channel, externalId])
  @@index([customerId, occurredAt])
  @@index([ticketId, occurredAt])
  @@index([customerId, channel, threadKey])
  @@index([occurredAt])
  @@map("customer_interactions")
}
```

Five things to get right, each for a reason:

- **`createdById String?` and `onDelete: SetNull`** — Product rule 3. The relation name `"CustomerInteractionAuthor"` is unchanged, so the matching field on `model User` needs no edit; confirm with `npx prisma validate`.
- **`@@unique([channel, externalId])`** — the idempotency key Story 23's webhook needs. PostgreSQL treats `NULL`s as distinct in a unique index, so the existing rows with `externalId: null` do **not** collide. Do **not** try for a filtered/partial index; Prisma cannot express one and the plain composite unique already behaves correctly.
- **`@@index([customerId, channel, threadKey])`** — Story 23's conversation grouping filters and groups on exactly these three, in this order.
- **`@@index([occurredAt])`** — Story 23's cross-customer unified timeline orders by `occurredAt desc` with no `customerId` predicate, so neither existing index helps it.
- **`metadata Json?`** — the first JSON column in this schema. It maps to `jsonb`. Keep the `///` doc comment: it is what stops a later story projecting a provider payload into a list response.

### 3 — The migration

Run, from `apps/api`:

```bash
npm run prisma:migrate -- --name communication_channels
```

Expect a folder `apps/api/prisma/migrations/<timestamp>_communication_channels/`. **Read the generated SQL before accepting it** and confirm all of:

- `CREATE TYPE "InteractionDeliveryStatus" AS ENUM (...)` with all five values.
- `ALTER TABLE "customer_interactions" ALTER COLUMN "created_by_id" DROP NOT NULL;`
- The author FK is dropped and re-added with `ON DELETE SET NULL` (Prisma emits `DROP CONSTRAINT` then `ADD CONSTRAINT`).
- Six `ADD COLUMN`s, with `"delivery_status" "InteractionDeliveryStatus" NOT NULL DEFAULT 'LOGGED'`.
- `CREATE UNIQUE INDEX "customer_interactions_channel_external_id_key"` plus the two new `CREATE INDEX`es.

If Prisma reports the change as requiring data loss, **stop** — it should not, because every added column is nullable or defaulted and the only relaxed constraint is a `NOT NULL` drop. Do not pass `--accept-data-loss`.

Then, in order:

```bash
npm run prisma:generate
npm run prisma:seed
```

### 4 — `Create file: apps/api/src/communication/channels/channel-adapter.ts`

The contract. Types and one symbol, no NestJS decorators — this file must be importable from a unit test with no module wiring.

```ts
import { InteractionChannel, InteractionDeliveryStatus, Prisma } from '@prisma/client';

/** What a channel needs to know about the customer to address a message.
 *  Deliberately three fields: an adapter that needed more would be reaching
 *  into the customer record rather than describing a channel. */
export interface ChannelCustomerContext {
  id: string;
  email: string | null;
  phone: string | null;
}

/** How the counterparty is identified on a channel. Drives which input the
 *  composer renders (Story 24), and nothing else. */
export type ChannelAddressKind = 'email' | 'phone' | 'session' | 'none';

export interface ChannelCapabilities {
  /** The workspace offers a Respond composer for this channel. */
  canRespond: boolean;
  /** Conversational rather than logged-after-the-fact. Ordering hint only. */
  isRealtime: boolean;
  /** An external sender is wired up. FALSE for every adapter in this repo. */
  providerConfigured: boolean;
  /** The channel can receive through POST /api/communication/inbound/:channel. */
  acceptsInbound: boolean;
  addressKind: ChannelAddressKind;
  /** Dispatch is a 400 when no address can be resolved. */
  requiresAddress: boolean;
  /** Hard body limit, in characters, or null for "only the 8000-char DTO cap". */
  maxBodyLength: number | null;
  /** False when the channel has no subject line of its own; the adapter
   *  synthesises one from the body so the NOT NULL column stays satisfied. */
  supportsSubject: boolean;
}

export interface OutboundMessage {
  subject?: string;
  body: string;
  /** Explicit counterparty address. When absent the adapter falls back to the
   *  customer record. */
  address?: string;
  occurredAt: Date;
  ticketId?: string;
}

export interface DispatchResult {
  status: InteractionDeliveryStatus;
  externalId: string | null;
  failureReason: string | null;
  metadata: Prisma.InputJsonValue | null;
}

/** A payload handed to an adapter by the inbound route (Story 23). */
export interface InboundPayload {
  address?: string;
  subject?: string;
  body: string;
  externalId?: string;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

/** What an adapter turns an InboundPayload into. The route, not the adapter,
 *  resolves the customer and writes the row. */
export interface NormalisedInbound {
  subject: string;
  body: string;
  address: string | null;
  externalId: string | null;
  occurredAt: Date;
  metadata: Prisma.InputJsonValue | null;
}

export interface ChannelAdapter {
  readonly channel: InteractionChannel;
  readonly capabilities: ChannelCapabilities;

  /**
   * Channel-specific validation. Throws BadRequestException with a message
   * naming the channel. Called before resolveAddress so an adapter can reject
   * an over-long body without needing an address.
   */
  validate(message: OutboundMessage): void;

  /**
   * The normalised counterparty address, or null when the channel has none.
   * Throws BadRequestException when capabilities.requiresAddress is true and
   * neither the message nor the customer supplies one.
   */
  resolveAddress(message: OutboundMessage, customer: ChannelCustomerContext): string | null;

  /** The subject to store. Channels with supportsSubject: false synthesise one. */
  resolveSubject(message: OutboundMessage): string;

  /** Groups rows into one conversation. Null means "ungrouped". */
  threadKey(address: string | null, ticketId?: string): string | null;

  /** No adapter in this repo contacts anything. See ChannelCapabilities. */
  dispatch(message: OutboundMessage, address: string | null): Promise<DispatchResult>;

  /** Only meaningful when capabilities.acceptsInbound is true. */
  parseInbound(payload: InboundPayload): NormalisedInbound;
}

/** Injection token for the adapter array. One array entry per channel is the
 *  whole registration surface. */
export const CHANNEL_ADAPTERS = Symbol('CHANNEL_ADAPTERS');
```

### 5 — `Create file: apps/api/src/communication/channels/base.channel.ts`

Every adapter shares five behaviours; put them here so the subclasses do not repeat them.

```ts
/** The subject synthesised for channels with no subject line of their own. */
const SYNTHETIC_SUBJECT_MAX = 80;

export abstract class BaseChannel implements ChannelAdapter {
  abstract readonly channel: InteractionChannel;
  abstract readonly capabilities: ChannelCapabilities;

  validate(message: OutboundMessage): void {
    const body = message.body?.trim() ?? '';

    if (body.length === 0) {
      throw new BadRequestException(`A ${this.channel} message needs a body.`);
    }

    const limit = this.capabilities.maxBodyLength;

    if (limit !== null && body.length > limit) {
      throw new BadRequestException(
        `A ${this.channel} message body cannot exceed ${limit} characters.`,
      );
    }
  }

  resolveAddress(message: OutboundMessage, customer: ChannelCustomerContext): string | null {
    if (this.capabilities.addressKind === 'none') {
      return null;
    }

    const raw = message.address?.trim() || this.customerAddress(customer);
    const normalised = raw ? this.normaliseAddress(raw) : null;

    if (!normalised && this.capabilities.requiresAddress) {
      throw new BadRequestException(
        `No ${this.capabilities.addressKind} address is available for a ${this.channel} message.`,
      );
    }

    return normalised;
  }

  resolveSubject(message: OutboundMessage): string {
    const explicit = message.subject?.trim();

    if (this.capabilities.supportsSubject && explicit) {
      return explicit;
    }

    // The column is NOT NULL and the timeline renders it as the entry heading,
    // so a channel with no subject line still needs one. First line, clipped.
    const firstLine = message.body.trim().split('\n')[0] ?? '';

    return firstLine.length > SYNTHETIC_SUBJECT_MAX
      ? `${firstLine.slice(0, SYNTHETIC_SUBJECT_MAX - 1)}…`
      : firstLine || this.channel;
  }

  threadKey(address: string | null, ticketId?: string): string | null {
    // A ticket is the strongest grouping signal there is: two agents replying
    // about one ticket are in one conversation even from different mailboxes.
    if (ticketId) {
      return `${this.channel}:ticket:${ticketId}`;
    }

    return address ? `${this.channel}:${address}` : null;
  }

  async dispatch(): Promise<DispatchResult> {
    // No transport exists in this repo (Product rule 5). Recording it IS the
    // send. An adapter that overrides this must also flip providerConfigured,
    // and channel-registry.service.spec.ts enforces that pairing.
    return {
      status: InteractionDeliveryStatus.LOGGED,
      externalId: null,
      failureReason: null,
      metadata: null,
    };
  }

  parseInbound(payload: InboundPayload): NormalisedInbound {
    if (!this.capabilities.acceptsInbound) {
      throw new BadRequestException(
        `The ${this.channel} channel does not accept inbound messages.`,
      );
    }

    const address = payload.address?.trim() ? this.normaliseAddress(payload.address.trim()) : null;

    return {
      subject: this.resolveSubject({
        subject: payload.subject,
        body: payload.body,
        occurredAt: payload.occurredAt ?? new Date(),
      }),
      body: payload.body.trim(),
      address,
      externalId: payload.externalId?.trim() || null,
      occurredAt: payload.occurredAt ?? new Date(),
      metadata: payload.metadata ?? null,
    };
  }

  /** Where this channel finds an address on the customer record. */
  protected abstract customerAddress(customer: ChannelCustomerContext): string | null;

  /** Channel-specific normalisation. Default: trim only. */
  protected normaliseAddress(raw: string): string | null {
    return raw.trim() || null;
  }

  /** Shared by SmsChannel and WhatsAppChannel — one normaliser, so the two
   *  cannot drift and split one customer's number into two thread keys. */
  protected normalisePhone(raw: string): string | null {
    const kept = raw.replace(/[^\d+]/g, '');
    const e164 = kept.startsWith('+') ? `+${kept.slice(1).replace(/\D/g, '')}` : kept.replace(/\D/g, '');
    const digits = e164.replace('+', '');

    if (digits.length < 8 || digits.length > 15) {
      throw new BadRequestException(`"${raw}" is not a usable phone number.`);
    }

    return e164;
  }
}
```

8–15 digits is the E.164 range (a minimum short enough for the shortest national numbers, a maximum that is the standard's own ceiling). It is deliberately not a dialling-plan validator — see Edge Cases.

### 6 — The eight adapters

**Create file: `apps/api/src/communication/channels/email.channel.ts`**

```ts
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmailChannel extends BaseChannel {
  readonly channel = InteractionChannel.EMAIL;

  readonly capabilities: ChannelCapabilities = {
    canRespond: true,
    isRealtime: false,
    providerConfigured: false,
    acceptsInbound: true,
    addressKind: 'email',
    requiresAddress: true,
    maxBodyLength: null,
    supportsSubject: true,
  };

  protected customerAddress(customer: ChannelCustomerContext): string | null {
    return customer.email;
  }

  protected normaliseAddress(raw: string): string | null {
    const lowered = raw.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(lowered)) {
      throw new BadRequestException(`"${raw}" is not a valid email address.`);
    }

    return lowered;
  }
}
```

Lower-casing matters: the thread key is built from the address, so `Nour@x.com` and `nour@x.com` must not split one conversation in two.

**Create file: `apps/api/src/communication/channels/sms.channel.ts`** — `canRespond: true`, `isRealtime: false`, `providerConfigured: false`, `acceptsInbound: true`, `addressKind: 'phone'`, `requiresAddress: true`, `maxBodyLength: 1600`, `supportsSubject: false`. `customerAddress` returns `customer.phone`; `normaliseAddress` delegates to `this.normalisePhone(raw)`.

`1600` is the concatenated-segment ceiling every SMS gateway shares. It lives here rather than in the DTO so the DTO's `@MaxLength(8000)` stays the one global cap.

**Create file: `apps/api/src/communication/channels/whatsapp.channel.ts`** — identical to `SmsChannel` except `isRealtime: true` and `maxBodyLength: 4096`. Same `normalisePhone` delegation.

**Create file: `apps/api/src/communication/channels/live-chat.channel.ts`** — `channel = InteractionChannel.CHAT`. `canRespond: true`, `isRealtime: true`, `providerConfigured: false`, `acceptsInbound: true`, `addressKind: 'session'`, `requiresAddress: false`, `maxBodyLength: 4096`, `supportsSubject: false`. `customerAddress` returns `null` — a chat session id lives on the session, not the customer record. `normaliseAddress` trims and rejects anything over 128 characters.

**Create file: `apps/api/src/communication/channels/web-form.channel.ts`** — `canRespond: **false**` (Product rule 4), `isRealtime: false`, `providerConfigured: false`, `acceptsInbound: true`, `addressKind: 'email'` (a form collects one), `requiresAddress: false`, `maxBodyLength: null`, `supportsSubject: true`. `customerAddress` returns `customer.email`; `normaliseAddress` reuses the email pattern. Override `dispatch()`:

```ts
  async dispatch(): Promise<DispatchResult> {
    // A form is a one-way intake. Reaching here means the dispatch route
    // ignored canRespond; fail loudly rather than writing a row that claims a
    // reply went out through a form.
    throw new BadRequestException('The WEB_FORM channel cannot send; reply by email instead.');
  }
```

**Create file: `apps/api/src/communication/channels/logged-only.channel.ts`** — one class covering `PHONE`, `MEETING`, and `OTHER`:

```ts
export class LoggedOnlyChannel extends BaseChannel {
  readonly capabilities: ChannelCapabilities;

  constructor(
    readonly channel: InteractionChannel,
    canRespond: boolean,
    isRealtime: boolean,
  ) {
    super();

    this.capabilities = {
      canRespond,
      isRealtime,
      providerConfigured: false,
      acceptsInbound: false,
      addressKind: 'none',
      requiresAddress: false,
      maxBodyLength: null,
      supportsSubject: true,
    };
  }

  protected customerAddress(): string | null {
    return null;
  }
}
```

Instantiated three times in the module (task 10) as `PHONE` (`canRespond: false`, `isRealtime: true`), `MEETING` (`false`, `false`), `OTHER` (`true`, `false`) — the exact values `CHANNEL_REGISTRY` (**21–68**) carries today. Not `@Injectable()`: it takes constructor arguments Nest cannot resolve, which is why it is provided through the factory rather than the DI container.

### 7 — `Create file: apps/api/src/communication/channel-registry.service.ts`

```ts
/** Display order for every channel picker and filter. Moved verbatim from the
 *  deleted apps/api/src/customers/channel.registry.ts. */
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

@Injectable()
export class ChannelRegistryService {
  private readonly byChannel: Map<InteractionChannel, ChannelAdapter>;

  constructor(@Inject(CHANNEL_ADAPTERS) adapters: ChannelAdapter[]) {
    this.byChannel = new Map(adapters.map((adapter) => [adapter.channel, adapter]));

    // Boot-time exhaustiveness. A ninth enum value with no adapter must fail
    // at startup, not on the first request that happens to use it.
    const missing = Object.values(InteractionChannel).filter((value) => !this.byChannel.has(value));

    if (missing.length > 0) {
      throw new Error(`No ChannelAdapter registered for: ${missing.join(', ')}`);
    }

    if (this.byChannel.size !== adapters.length) {
      throw new Error('Two ChannelAdapters claim the same InteractionChannel.');
    }
  }

  resolve(channel: InteractionChannel): ChannelAdapter {
    const adapter = this.byChannel.get(channel);

    if (!adapter) {
      // Unreachable given the constructor guard; kept so the return type is
      // non-nullable for every caller.
      throw new BadRequestException(`Unsupported channel: ${channel}`);
    }

    return adapter;
  }

  descriptors(): ChannelDescriptorDto[] {
    return CHANNEL_ORDER.map((key) => ({ key, ...this.resolve(key).capabilities }));
  }
}
```

**Delete `apps/api/src/customers/channel.registry.ts` and `apps/api/src/customers/channel.registry.spec.ts`.** Their exhaustiveness and `providerConfigured` assertions are reproduced against the service in `channel-registry.service.spec.ts` (Test Plan item 3) — do not simply drop them.

### 8 — `Create file: apps/api/src/communication/dto/channel.dto.ts`

Move `ChannelDescriptorDto` and `ChannelListDto` from `apps/api/src/customers/dto/channel.dto.ts` (which is **deleted**), keeping the four existing fields with their existing `@ApiProperty` descriptions **verbatim** — the frontend reads them today — and adding five:

```ts
export class ChannelDescriptorDto {
  @ApiProperty({ enum: InteractionChannel })
  key!: InteractionChannel;

  // --- the four fields Story 19 shipped; text unchanged -------------------
  @ApiProperty({ description: 'The workspace offers a Respond composer for this channel.' })
  canRespond!: boolean;

  @ApiProperty({ description: 'The channel is conversational rather than logged-after-the-fact.' })
  isRealtime!: boolean;

  @ApiProperty({
    description:
      'Whether an external sender is wired up for this channel. False for every ' +
      'channel today — no provider integration exists in this project yet.',
  })
  providerConfigured!: boolean;

  // --- new in Story 22; additive only ------------------------------------
  @ApiProperty({ description: 'The channel can receive through the inbound ingestion route.' })
  acceptsInbound!: boolean;

  @ApiProperty({ enum: ['email', 'phone', 'session', 'none'] })
  addressKind!: ChannelAddressKind;

  @ApiProperty({ description: 'Dispatch fails with 400 when no address can be resolved.' })
  requiresAddress!: boolean;

  @ApiProperty({ required: false, nullable: true, example: 1600 })
  maxBodyLength!: number | null;

  @ApiProperty({ description: 'False when the adapter synthesises the subject from the body.' })
  supportsSubject!: boolean;
}
```

`ChannelListDto` moves unchanged, including its "object wrapper, not a bare array" comment.

### 9 — `Create file: apps/api/src/communication/channels.controller.ts`

A move of the deleted `apps/api/src/customers/channels.controller.ts` with two edits: it injects `ChannelRegistryService`, and `list()` returns `{ items: this.registry.descriptors() }`. **Keep** `@ApiTags('communication')`, `@Controller('communication/channels')`, `@RequirePermissions('customers:read')`, and the `@ApiOperation` summary and description text — the path, the permission, and the envelope are a shipped contract.

### 10 — `Create file: apps/api/src/communication/communication.module.ts`

```ts
const LOGGED_ONLY_ADAPTERS: ChannelAdapter[] = [
  new LoggedOnlyChannel(InteractionChannel.PHONE, false, true),
  new LoggedOnlyChannel(InteractionChannel.MEETING, false, false),
  new LoggedOnlyChannel(InteractionChannel.OTHER, true, false),
];

@Module({
  imports: [AuthModule, CustomersModule, TicketsModule],
  controllers: [ChannelsController],
  providers: [
    EmailChannel,
    WhatsAppChannel,
    LiveChatChannel,
    SmsChannel,
    WebFormChannel,
    ChannelRegistryService,
    {
      provide: CHANNEL_ADAPTERS,
      inject: [EmailChannel, WhatsAppChannel, LiveChatChannel, SmsChannel, WebFormChannel],
      useFactory: (...injected: ChannelAdapter[]): ChannelAdapter[] => [
        ...injected,
        ...LOGGED_ONLY_ADAPTERS,
      ],
    },
  ],
  exports: [ChannelRegistryService],
})
export class CommunicationModule {}
```

`CustomersModule` and `TicketsModule` are imported now — not in Story 23 — because that is where the module's dependency edges belong, and both already export what Story 23 needs (`InteractionsService` at `customers.module.ts` **30**, `TicketsService` at `tickets.module.ts` **33**). There is no cycle: `TicketsModule` imports `CustomersModule`, and neither imports `CommunicationModule`.

**File: `apps/api/src/customers/customers.module.ts`** — remove the `ChannelsController` import (**6**) and its entry in `controllers` (**21**). Leave `providers` and `exports` (**23–30**) alone.

**File: `apps/api/src/app.module.ts`** — import `CommunicationModule` alongside the others (**6–16**) and register it in the array (**57–66**), after `TicketsModule` and before `DashboardModule`.

### 11 — `InteractionsService`: one write path, widened

**File: `apps/api/src/customers/interactions.service.ts`**

`INTERACTION_SELECT` (**17–30**) gains six entries:

```ts
  deliveryStatus: true,
  channelAddress: true,
  externalId: true,
  failureReason: true,
  threadKey: true,
  customer: { select: CUSTOMER_REF_SELECT },
```

`metadata` is **deliberately absent** — Product rule 2's diagnostic column is not projected into responses.

Import `CUSTOMER_REF_SELECT` from `../tickets/tickets.service`. That import direction is safe: `CustomersModule` does not import `TicketsModule`, and this is a constant import, not an injection.

Add an options type and widen `create()` (**68–105**):

```ts
/** Everything a channel adapter contributes to a stored interaction. Absent
 *  for the two agent-logging routes, which record LOGGED with no address. */
export interface InteractionDelivery {
  deliveryStatus?: InteractionDeliveryStatus;
  channelAddress?: string | null;
  externalId?: string | null;
  failureReason?: string | null;
  threadKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

  async create(
    customerId: string,
    dto: CreateInteractionDto,
    caller: AuthenticatedUser | null,
    delivery: InteractionDelivery = {},
  ): Promise<InteractionResponseDto> {
```

- Keep the `assertExists`, `FIVE_MINUTES_MS`, and `assertTicketBelongsToCustomer` guards **exactly** as they are at **73–83**. An inbound webhook is not exempt from "an interaction cannot have happened in the future".
- `createdById: caller?.id ?? null`.
- Write the delivery fields into `data`, defaulting `deliveryStatus` to `InteractionDeliveryStatus.LOGGED` and `metadata` to `Prisma.DbNull` (see Edge Cases).
- The log line at **99–102** gains `deliveryStatus` and keeps `actorId: caller?.id ?? null`.

`remove()` (**107–126**) — the author check at **117** becomes:

```ts
    // A null author is nobody's row: an ingested message can only be deleted by
    // an ARCHIVE_PERMISSION holder, by rule rather than by accident.
    const isAuthor = interaction.createdById !== null && interaction.createdById === caller.id;

    if (!isAuthor && !caller.permissions.includes(ARCHIVE_PERMISSION)) {
```

`toResponse()` (**148–162**) returns the new fields and `customer`.

### 12 — DTO updates

**File: `apps/api/src/customers/dto/interaction.dto.ts`**

Add a customer ref beside `InteractionTicketRefDto` (**55–61**), matching `CUSTOMER_REF_SELECT` (`tickets.service.ts` **22–27**) field for field:

```ts
/** The customer an interaction belongs to. Present on every interaction
 *  response so the cross-customer timeline (Story 23) needs no second read. */
export class InteractionCustomerRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Layla Ibrahim' })
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  email!: string | null;
}
```

`InteractionResponseDto` (**63–96**): `createdBy` becomes nullable and seven fields are added.

```ts
  @ApiProperty({
    type: () => UserRefDto,
    nullable: true,
    description:
      'The agent who logged it, or null for a message ingested through the ' +
      'inbound route — no user typed it (Story 22 Product rule 3).',
  })
  createdBy!: UserRefDto | null;

  @ApiProperty({ type: () => InteractionCustomerRefDto })
  customer!: InteractionCustomerRefDto;

  @ApiProperty({ enum: InteractionDeliveryStatus })
  deliveryStatus!: InteractionDeliveryStatus;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'The counterparty address on this channel: a mailbox, an E.164 number, a session id.',
  })
  channelAddress!: string | null;

  @ApiProperty({ required: false, nullable: true, description: "The provider's message id." })
  externalId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  failureReason!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Groups rows into one conversation. Null for rows logged before Story 22.',
  })
  threadKey!: string | null;
```

**File: `apps/api/src/customers/dto/list-interactions-query.dto.ts`** — add an optional `deliveryStatus` with `@IsEnum(InteractionDeliveryStatus)`, matching the existing three filters' shape (**11–27**). Leave the "not paginated" doc comment (**5–9**) in place; it is still true for this route.

**File: `apps/api/src/customers/interactions.service.ts`**, `list()` (**45–66**) — add `if (query.deliveryStatus) where.deliveryStatus = query.deliveryStatus;` beside the other three. Do **not** touch the two-key `orderBy` at **62**.

### 13 — The permission key and the environment variable

**File: `apps/api/prisma/seed.ts`**

Add one entry to `permissions` (**41–70**), after `quick-replies:write` (**68**):

```ts
  { key: 'communication:send', description: 'Send a message through a communication channel' },
```

Add the key to `crm-manager` (**83–112**), `support-supervisor` (**118–139**), and `support-agent` (**145–161**). Do **not** add it to `reporting-user` (**173–180**) or `customer` (**167**). `system-administrator` (**77**) picks it up automatically from `permissions.map(...)`.

**File: `apps/api/src/config/env.validation.ts`**

Add to `EnvironmentVariables`, after `MAX_UPLOAD_BYTES` (**82**):

```ts
  /** Shared secret the inbound-ingestion route requires in x-communication-secret
   *  (Story 23). Absent by default, and absent means that route returns 503 —
   *  there is no unauthenticated write path unless an operator opts in. */
  @IsString()
  @IsOptional()
  @MinLength(32, { message: 'COMMUNICATION_INBOUND_SECRET must be at least 32 characters' })
  COMMUNICATION_INBOUND_SECRET?: string;
```

`@IsOptional()` is load-bearing: `validateEnv` (**91–101**) throws on any constraint violation, so a required variable here would stop every existing `.env` from booting.

### 14 — Swagger

**File: `apps/api/src/main.ts`** — the `communication` tag already exists at **58**. Change its description from `'Communication channel metadata'` to `'Communication channels, dispatch, and inbound ingestion'`. No new tag in this story.

## Frontend Tasks

**No frontend changes required.** Product rule 9 records why, and Story 23 carries the one null-guard that becomes necessary the moment inbound rows can exist.

---

## Edge Cases & Failure Modes

- **A ninth `InteractionChannel` value with no adapter.** `ChannelRegistryService`'s constructor throws at boot with the missing value named (`channel-registry.service.ts`, task 7). This replaces the compile-time guarantee the deleted `Record<InteractionChannel, ChannelDescriptor>` gave — weaker (boot-time, not compile-time) but it fails before serving a request, and Test Plan item 3 covers it.
- **Two adapters claiming one channel.** Caught by the `size !== length` check in the same constructor. Without it, `new Map(...)` would silently keep the last one and the first would never dispatch.
- **Existing rows have `threadKey: null`.** Every interaction written before this migration groups under one `(customerId, channel, null)` bucket. Story 23's conversation grouping therefore shows one "legacy" conversation per customer per channel. Documented, not backfilled: a backfill would have to invent addresses that were never recorded.
- **Many rows with `externalId: null` under `@@unique([channel, externalId])`.** PostgreSQL treats `NULL` as distinct in a unique index, so this is not a collision. Verify explicitly after migrating — Verification step 5 inserts two `PHONE` rows with a null `externalId` through the existing route and expects both to succeed.
- **An authorless interaction and `remove()`.** `createdById: null` must never satisfy the author check. Enforced by the explicit `!== null` in task 11; only an `ARCHIVE_PERMISSION` holder can delete an ingested message.
- **`Prisma.InputJsonValue` and `null`.** Prisma distinguishes JSON null (`Prisma.JsonNull`) from SQL NULL (`Prisma.DbNull`); passing plain `null` for a `Json?` field in a `create` is a type error. Use `metadata: delivery.metadata ?? Prisma.DbNull` — the column means "no payload recorded", not "a payload whose value is null".
- **An email address differing only by case.** `EmailChannel.normaliseAddress` lower-cases before it validates, so the thread key is stable. A phone number written `+20 100 123 4567` and `00201001234567` still produces **different** keys — `normalisePhone` does not know the dialling plan and will not guess one. A known limitation: it splits a conversation, it does not lose data.
- **A body of only whitespace.** `BaseChannel.validate` trims first, so `"   "` is a 400 (`A EMAIL message needs a body.`), not a stored empty message. Note that `CreateInteractionDto.body` (**29–33**) is *optional*: dispatch requires a body, logging does not. The asymmetry is deliberate — you can log "phoned the customer, no answer" with no body, but you cannot send an empty email.
- **`WEB_FORM` dispatch.** Throws from the adapter (task 6) rather than writing a row. Reachable only when a caller ignores `canRespond`, which is a UI hint — so the server-side throw is the actual enforcement.
- **`SmsChannel`'s limit vs the DTO cap.** A 5000-character SMS body passes `CreateInteractionDto`'s `@MaxLength(8000)` and is rejected by the adapter's 1600 limit with a channel-specific message. Both stay: the DTO cap protects the column, the adapter cap describes the channel.
- **Unicode in a synthesised subject.** `resolveSubject` slices at 80 **UTF-16 code units**, which can split an emoji or a combining mark. Acceptable for a display heading; do not "fix" it with a dependency. Arabic text is unaffected — the script has no surrogate pairs in common use.
- **The migration on a database with rows referencing a deleted user.** Impossible today: the FK is `Restrict`, so no such row exists. Afterwards it is `SetNull`, meaning deleting a user now **blanks** their authorship on past interactions rather than blocking the delete. That is a real behaviour change to user deletion; it is the intended trade for Product rule 3, and it matches how `Ticket.createdById` (schema **352**) has always behaved.

---

## Test Plan

1. **Unit — `apps/api/src/communication/channels/email.channel.spec.ts`** (new). `validate` rejects an empty and a whitespace-only body; `resolveAddress` lower-cases, falls back to `customer.email`, prefers an explicit `message.address`, throws when both are absent, and throws on `"not-an-email"`; `resolveSubject` returns the explicit subject; `threadKey` returns `EMAIL:ticket:<id>` when a `ticketId` is present and `EMAIL:<address>` otherwise.
2. **Unit — `apps/api/src/communication/channels/sms.channel.spec.ts`** (new). `normaliseAddress` turns `'+20 100 123 4567'` into `'+201001234567'` and rejects `'123'` and a 20-digit string; `validate` rejects a 1601-character body and accepts 1600; `resolveSubject` synthesises from the first line and appends `'…'` past 80 characters. Add the same shape for `whatsapp.channel.spec.ts` (4096 limit, `isRealtime: true`), `live-chat.channel.spec.ts` (no customer address, `requiresAddress: false` so a null address is allowed), and `web-form.channel.spec.ts` (`dispatch()` rejects; `parseInbound` succeeds).
3. **Unit — `apps/api/src/communication/channel-registry.service.spec.ts`** (new; replaces the deleted `apps/api/src/customers/channel.registry.spec.ts`, carrying over all four of its assertions):
   - an adapter for every `Object.values(InteractionChannel)` member, each reporting the channel it is keyed under (was `channel.registry.spec.ts` **5–10**);
   - `CHANNEL_ORDER` has the enum's length, no duplicates, and contains every value (was **12–21**);
   - `providerConfigured` is `false` for every adapter (was **23–27**);
   - `canRespond` is false for **exactly `PHONE`, `MEETING`, and `WEB_FORM`** (was **29–37**, with `WEB_FORM` added per Product rule 4 — update the assertion, do not delete it);
   - the constructor throws when an adapter is missing, and throws when two adapters share a channel;
   - `descriptors()` returns eight items in `CHANNEL_ORDER`, each carrying all nine fields.
4. **Unit — same file.** Every adapter's `dispatch()` resolves to `{ status: 'LOGGED', externalId: null, failureReason: null }`, except `WebFormChannel`, which rejects. This is what makes Product rules 5 and 6 tested facts rather than comments.
5. **Unit — `apps/api/src/customers/interactions.service.spec.ts`** (modify). Extend `baseInteractionRow` (**13–26**) with the six columns and a `customer` ref. Add: `create()` with no `delivery` argument writes `deliveryStatus: 'LOGGED'` and a null address; `create()` with a delivery argument writes it through; `create()` with `caller: null` writes `createdById: null`; `remove()` on a row with `createdById: null` throws `ForbiddenException` for a caller without `customers:archive` and resolves for one with it; `list()` passes a `deliveryStatus` filter into `where`.
6. **E2E — `apps/api/test/communication.e2e-spec.ts`** (modify). Keep all three existing tests (**94–128**) passing unchanged. Add: every item carries the five new fields; `WEB_FORM` reports `canRespond: false` and `acceptsInbound: true`; `SMS` reports `maxBodyLength: 1600` and `addressKind: 'phone'`; `PHONE` reports `addressKind: 'none'`.
7. **E2E — `apps/api/test/customer-children.e2e-spec.ts`** (modify). The existing interaction assertions must still pass. Add one that pins the shipped agent-logging contract: a logged interaction returns `deliveryStatus: 'LOGGED'`, `channelAddress: null`, `threadKey: null`, and a non-null `createdBy`.
8. **E2E — `apps/api/test/seed.e2e-spec.ts`** (modify). `communication:send` exists and is held by `system-administrator`, `crm-manager`, `support-supervisor`, and `support-agent`, and **not** by `reporting-user` or `customer`.

---

## Migration / Rollback

- **Forward:** `npm run prisma:migrate -- --name communication_channels`, then `npm run prisma:generate`, then `npm run prisma:seed`, from `apps/api`. The seed is required — without it `communication:send` does not exist and Story 23's dispatch route is unreachable for every role including the administrator.
- **Half-applied risk.** The migration is one transaction in PostgreSQL, so it either fully applies or fully rolls back. The realistic half-state is *migration applied, seed not run*: symptom is a 403 from Story 23's dispatch route for every caller, and the fix is re-running the seed.
- **Rollback:** `npx prisma migrate resolve --rolled-back <migration-name>`, restore `schema.prisma` from git, re-run `prisma:generate`. Dropping the six columns loses only data written after the migration. **`created_by_id` cannot be restored to `NOT NULL` while any authorless row exists** — run `DELETE FROM customer_interactions WHERE created_by_id IS NULL` first, or the `ALTER COLUMN SET NOT NULL` fails. Story 23 is what creates such rows, so rolling back this story alone is safe.
- The seeded `communication:send` key is not removed by a rollback. An orphaned permission key with no route behind it is harmless.

---

## Verification Steps

1. **Backend builds:** from `apps/api`, `npm run typecheck`, then `npm run build`. Both clean. `npx prisma validate` reports no errors.
2. **Migration applies:** from `apps/api`, `npm run prisma:migrate -- --name communication_channels`, then `npm run prisma:generate`, then `npm run prisma:seed`. Read the generated SQL against the five bullets in task 3.
3. **Backend unit tests:** from `apps/api`, `npm test`. All pass, including the new adapter and registry specs.
4. **Boot:** `npm run dev:api` from the repo root starts with no error. A missing adapter throws during module instantiation, so a clean start *is* the exhaustiveness check.
5. **Regression — the shipped contract:** `GET /api/communication/channels` with an admin token returns 8 items in `EMAIL, WHATSAPP, CHAT, SMS, WEB_FORM, PHONE, MEETING, OTHER` order, every `providerConfigured: false`, and `WEB_FORM.canRespond: false`. Then `POST /api/customers/:id/interactions` twice with `channel: 'PHONE'` — both return 201, confirming the null-`externalId` uniqueness behaviour.
6. **Regression — the frontend is untouched and still works:** with both dev servers running (`npm run dev:api`, `npm run dev:web`), open a ticket workspace and confirm the communication timeline still lists interactions and the Respond composer still logs one. **Web Form disappears from the composer's channel picker** — that is Product rule 4 landing, not a bug.
7. **E2E:** from `apps/api`, `npm run test:e2e`. All specs pass.

---

## Done Criteria

- [ ] `InteractionDeliveryStatus` exists with five values; `customer_interactions` has `delivery_status` (NOT NULL, default `LOGGED`), `channel_address`, `external_id`, `failure_reason`, `thread_key`, and `metadata` (jsonb).
- [ ] `customer_interactions.created_by_id` is nullable with `ON DELETE SET NULL`; `InteractionResponseDto.createdBy` is `UserRefDto | null`.
- [ ] `@@unique([channel, externalId])` plus the `[customerId, channel, threadKey]` and `[occurredAt]` indexes exist, and two null-`externalId` rows on one channel both insert.
- [ ] One Prisma-generated migration exists and `npx prisma migrate status` reports no drift.
- [ ] `apps/api/src/communication/` contains `channels/channel-adapter.ts`, `channels/base.channel.ts`, the five named channel adapters, `channels/logged-only.channel.ts`, `channel-registry.service.ts`, `channels.controller.ts`, `communication.module.ts`, and `dto/channel.dto.ts`.
- [ ] `apps/api/src/customers/channel.registry.ts`, `channel.registry.spec.ts`, `channels.controller.ts`, and `dto/channel.dto.ts` are **deleted**, and `customers.module.ts` no longer references `ChannelsController`.
- [ ] `ChannelRegistryService` throws at boot on a missing or duplicated adapter, and `descriptors()` returns eight items in `CHANNEL_ORDER`.
- [ ] Every adapter reports `providerConfigured: false`; every `dispatch()` returns `LOGGED` except `WebFormChannel`, which rejects.
- [ ] `canRespond` is false for exactly `PHONE`, `MEETING`, and `WEB_FORM`.
- [ ] `GET /api/communication/channels` keeps its path, its `customers:read` gate, and its `{ items: [...] }` envelope, and returns the five new fields per channel.
- [ ] `InteractionsService.create()` accepts a nullable caller and an optional delivery argument; the future-`occurredAt` and ticket-belongs-to-customer guards are unchanged; `remove()` treats a null author as "not the author".
- [ ] `communication:send` is seeded and held by the four staff roles only; `COMMUNICATION_INBOUND_SECRET` is declared optional in `env.validation.ts`.
- [ ] `apps/api/package.json` is **unchanged** — no new dependency.
- [ ] No file under `apps/web/` is modified.
- [ ] `npm run typecheck`, `npm test`, and `npm run test:e2e` all pass in `apps/api`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 23.**
