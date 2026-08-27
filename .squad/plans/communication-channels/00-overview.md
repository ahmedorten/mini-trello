# communication-channels — plan overview

Entry point for the **communication-channels** feature. Stories execute in order by their `NN` prefix.

Azure DevOps work item **6 — "Communication Channels"** is split into **three** sequential stories, not the four or five its predecessors took. The reason is that work item 5 already shipped the storage layer this work item would otherwise have to build: `customer_interactions` exists, it already links to both a customer and a ticket, the eight-value `InteractionChannel` enum exists, and a per-ticket communication timeline already renders in the workspace. What work item 6 adds on top of that is a genuine **abstraction layer** (a per-channel adapter contract with five named implementations), a **delivery lifecycle** on the stored interaction, **inbound ingestion**, a **cross-customer unified timeline**, and a **conversation interface**. That divides cleanly into one data-model-and-abstraction story, one API story, and one frontend story. All three share tracker id 6; each ends with a stop-and-report gate.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 22 | [22-story-communication-abstraction-data-model-6.md](22-story-communication-abstraction-data-model-6.md) | Communication abstraction layer and channel delivery data model | 6 | 21 |
| 23 | [23-story-channel-dispatch-inbound-timeline-api-6.md](23-story-channel-dispatch-inbound-timeline-api-6.md) | Channel dispatch, inbound ingestion, and the unified timeline API | 6 | 22 |
| 24 | [24-story-frontend-conversation-timeline-6.md](24-story-frontend-conversation-timeline-6.md) | Frontend: the conversation inbox and the unified timeline interface | 6 | 23 |

## Dependency notes

**Strictly sequential.** Each story ends with a `STOP HERE` gate; do not start the next until the previous one's Done Criteria are met.

- **21 → 22.** This feature is built entirely on top of [work item 5](../agent-dashboard-and-collaboration-and-enhancement-ui/00-overview.md). Story 22 replaces three files Story 19 shipped (`customers/channel.registry.ts`, `customers/channels.controller.ts`, `customers/dto/channel.dto.ts`), extends the `customer_interactions` table Story 17 last migrated, and must leave `CommunicationTimeline.vue` — a Story 21 file — working untouched.
- **22 → 23.** Story 22 is the **only** story in this feature that creates a migration. Every column, enum value, index, permission key, and environment variable Story 23 writes to is created there: `InteractionDeliveryStatus`, the six delivery columns, the nullable `created_by_id`, `@@unique([channel, externalId])`, `communication:send`, and `COMMUNICATION_INBOUND_SECRET`. Story 23 adds routes and nothing else.
- **23 → 24.** Story 24 consumes four routes and calls no endpoint Story 23 did not ship. It is sequenced after so the response shapes are frozen before the frontend commits to translation keys for five delivery statuses and nine descriptor fields.
- **The nullable-author sequencing is deliberate.** Story 22 makes `InteractionResponseDto.createdBy` nullable; Story 23 ships the route that can actually produce a null and therefore carries the three-line frontend null-guard; Story 24 does the full UI. Splitting it that way means no story boundary leaves a shipped screen able to dereference null. The API DTOs are not imported by `apps/web` — it mirrors them in hand-written types — so Story 22's DTO change cannot break `vue-tsc` on its own.

### Shared contracts

Changing any of these requires updating every story that references it, in the same commit.

| Contract | Defined in | Consumed by |
|---|---|---|
| `ChannelAdapter` — `validate` / `resolveAddress` / `resolveSubject` / `threadKey` / `dispatch` / `parseInbound`, plus `ChannelCapabilities`' nine fields | Story 22 task 4 | Story 23's dispatch and ingestion services (in that call order); Story 24's composer, via the descriptor endpoint |
| `ChannelRegistryService.resolve()` / `descriptors()` and `CHANNEL_ORDER` | Story 22 task 7 | Story 23 (the only way to reach an adapter); Story 24's `INTERACTION_CHANNELS` ordering |
| `InteractionDeliveryStatus` (`LOGGED`, `RECEIVED`, `QUEUED`, `SENT`, `FAILED`) | Story 22 task 1 | Story 23's dispatch (`LOGGED`) and ingestion (`RECEIVED`) writes and its `deliveryStatus` filters; Story 24's `interaction.delivery.*` keys and `DELIVERY_TONES` |
| The six delivery columns and the nullable `created_by_id` | Story 22 tasks 2–3 | Story 23's idempotency lookup and authorless writes; Story 24's badges, address line, and `systemAuthor` fallback |
| `@@unique([channel, externalId])` | Story 22 task 2 | Story 23's inbound idempotency, including the `P2002` fallback |
| `InteractionsService.create(customerId, dto, caller \| null, delivery?)` — the **single** write path, with the five-minute future-`occurredAt` guard and the ticket-belongs-to-customer guard intact | Story 22 task 11 | Story 23's dispatch and ingestion services, which must not touch Prisma directly |
| Exported `INTERACTION_SELECT` and a shared response mapper | Story 23 task 7 | Story 23's `TimelineService`, so the two timelines cannot drift in shape |
| `InteractionResponseDto` gaining `customer`, `deliveryStatus`, `channelAddress`, `externalId`, `failureReason`, `threadKey`, and a nullable `createdBy` | Story 22 task 12 | Story 23's three read routes; Story 24's `CustomerInteraction` mirror |
| `communication:send` — the one new permission key | Story 22 task 13 | Story 23's dispatch gate; Story 24's `auth.can('communication:send')` submit routing |
| `COMMUNICATION_INBOUND_SECRET`, optional, min 32 characters | Story 22 task 13 | Story 23's `InboundSecretGuard` (503 when unset, 401 on mismatch) |
| `GET /api/communication/channels` — same path, same `customers:read` gate, same `{ items: [...] }` envelope, five additive fields | Story 22 tasks 8–9 | Story 24's descriptor-driven composer; the Story 21 code that already reads it |
| `POST /api/communication/messages`, `POST /api/communication/inbound/:channel`, `GET /api/communication/timeline`, `GET /api/communication/conversations` | Story 23 tasks 1–5 | Story 24 exclusively |
| `CHANNEL_ICONS` and `DELIVERY_TONES` | Story 24 task 2 | Story 24's timeline entries and conversation cards |
| `en.json` / `ar.json` with identical key sets, enforced by `i18n.spec.ts` | Story 23 (`communication.systemAuthor`) and Story 24 task 8 | Every component in Stories 23–24 |

### Product decisions

Resolved once, in each story's **Product rules (from story)** table. Summarised here so no later story re-litigates them.

- **Still no external provider, and now that is a tested fact.** No SMTP client, no Twilio or WhatsApp SDK, no chat socket, and **no new npm dependency on either side of the repo**. `providerConfigured` is `false` for all eight channels and every shipped `dispatch()` returns `LOGGED`; `channel-registry.service.spec.ts` asserts both in one loop, so a future adapter cannot start sending silently. This continues work item 5's decision rather than reversing it — what work item 6 adds is the *seam*, fully built and exercised, not the transport.
- **The abstraction is a class per channel, not a constant.** A `Record<InteractionChannel, ChannelDescriptor>` cannot hold address normalisation, per-channel body limits, subject synthesis, or thread derivation — the four things that actually differ between email and SMS. Deriving the metadata endpoint from the adapters means it can never disagree with the code that dispatches.
- **`QUEUED`, `SENT`, and `FAILED` are declared but unreachable today**, and that unreachability is asserted. They are the seam; declaring them now means a future provider adds an adapter override, not a migration.
- **`createdById` is nullable, and there is no seeded "system" user.** A fake login-shaped row that exists only to be a foreign key would make every per-agent report count machine traffic as human work. `Ticket.createdById` has always been nullable; this makes the two consistent. A null author is nobody's row: only a `customers:archive` holder can delete an ingested message, by rule rather than by accident.
- **`WEB_FORM.canRespond` is corrected from `true` to `false`.** A form is a one-way intake; the reply goes out by email. Story 19 set it true because the intake listed five channels and took the list literally. This is a knowing behaviour correction with its test and its UI consequence both updated in the same story.
- **Dispatch is a separate route from logging, with a separate permission.** Logging records something that already happened, with no address and no channel rules. Dispatching addresses a customer on a channel and — the day a provider exists — contacts them. Folding them together would either impose email validation on "phoned the customer, no answer" or hand every `interactions:write` holder a send button.
- **`direction` is never a client input on the new write routes.** The route is the direction: dispatch writes `OUTBOUND`, ingestion writes `INBOUND`. Accepting the field would let a POST claim the customer sent something the agent typed.
- **Inbound ingestion fails closed.** It is the only public write route in the API. `@Public()` is unavoidable for a webhook, which makes the shared secret the entire boundary — so it is compared with `crypto.timingSafeEqual`, and an unset `COMMUNICATION_INBOUND_SECRET` yields **503**, not an open door. The 503 is deliberately distinct from the 401 a wrong secret gets, so an operator can tell which is wrong without either response revealing the secret.
- **Ingestion is idempotent on `(channel, externalId)`,** returning 200 with the stored row on a repeat, and the concurrent-delivery `P2002` is caught and folded into the same path. Every webhook sender retries in bursts; without this, one flaky hop duplicates a customer's message in the timeline. A payload with no `externalId` is never deduplicated — guessing by body hash would merge two genuinely identical messages sent a minute apart.
- **An unmatched inbound address is a 404, not a holding table.** A webhook needs a machine-readable "not filed" signal. A quarantine table is a triage feature with its own UI, and nothing in this work item asks for one.
- **Dispatch to an archived customer is a 400; ingestion for one still stores.** Sending to an archived customer is almost certainly a mistake. Refusing to *record* what they sent would lose data — and an inbound message is often exactly the reason to un-archive.
- **The unified timeline is paginated; the per-customer and per-ticket timelines stay unpaginated.** Work items 3 and 5 chose the latter and two shipped screens depend on it. A feed across every customer has no natural bound, so it is paginated from the first commit. The asymmetry is recorded in the existing DTO comment.
- **`scope`-style filters are filters, not security boundaries** — `mine` on the timeline is shorthand for `assignedAgentId = caller`, and an explicit `assignedAgentId` wins over it. Same precedence rule the agent-tasks list already uses.
- **No new read permission.** `customers:read` already permits listing every customer, so it already permits reading their conversations. A second read key would gate nothing and would need adding to five seeded roles to avoid breaking them.
- **Conversations group on `(customerId, channel, threadKey)`, and `threadKey` is derived by the adapter, never supplied by a client.** A client-settable key lets two agents split one conversation in half. `threadKey` is `null` for every pre-existing row — those group into one labelled "Earlier history" conversation per customer per channel, which is an honest representation of what was recorded rather than a backfill of invented addresses.
- **A conversation's preview row is the newest by `occurredAt`, ties broken arbitrarily but deterministically.** The tie is two messages at the identical millisecond; picking the first row of an ordered result beats the only raw SQL window function in the API for a preview line.
- **Search is `contains` with `mode: 'insensitive'` over subject and body.** The same idiom the customer and ticket list filters already use. No tsvector column, no ranking, and no Arabic normalisation of alef variants or diacritics — a recorded limitation.
- **One timeline component, three data sources.** `CommunicationTimeline.vue` becomes ticket-scoped, customer-scoped, or unscoped. Three near-identical components is how the customer profile ended up hand-rolling its own list; one component means the delivery badge, the ticket-link rendering, and the race guard are written once.
- **Channel descriptors move to their own store, and the dashboard store loses them.** Two stores owning one cached list is a stale-data bug waiting for a second consumer. The fail-open fallback moves with them unchanged: a descriptor fetch failure must never hide the composer everywhere.
- **The composer is descriptor-driven.** The address field, the subject field, and the body limit all come from the selected channel's capabilities, and a missing required address disables Send with a translated inline message rather than letting the request 400 — because `toErrorMessage` surfaces the server's English text even in an Arabic UI.
- **The no-provider notice stays, and stays non-dismissible.** A Send button whose only effect is a database row must say so every time, not once.
- **Delivery status renders for all five values, `LOGGED` included.** Hiding the common value trains the eye to ignore the badge, which is exactly when `FAILED` needs to be legible.
- **The selected conversation lives in a query parameter, not a path segment.** A thread key is derived, opaque, and nullable — three properties that make a bad URL segment — and `router.replace` keeps five clicks from filling the back stack.
- **Still nothing polls.** No interval, no websocket, no SSE. Refresh is on mount, on a filter change, on an explicit Refresh, and after a mutation the screen itself performed. Work item 5 chose to make staleness visible; a timer here would be the first exception.

### Deliberate scope exclusions

Recorded so later stories do not treat them as oversights.

- **No outbound transport for any channel.** The five named channels are validation, addressing, threading, and a permission boundary — not senders. Adding one is a per-adapter `dispatch()` override plus flipping `providerConfigured`.
- **No inbound quarantine or triage UI.** An unmatched address is a 404 to the sender.
- **No webhook signature verification** beyond the shared secret — no HMAC over the body, no per-sender key, no replay window. A single symmetric secret is the boundary this work item asks for; provider-specific signature schemes belong with the provider integrations that are excluded.
- **No rate limiting on the inbound route.** No rate-limiting infrastructure exists anywhere in this API; adding it for one route would be the only instance of it. Worth flagging to whoever exposes the route publicly.
- **No delivery-receipt or read-receipt handling.** `SENT` is as far as the declared lifecycle goes; a `DELIVERED` value would need a provider to report it.
- **No `threadKey` filter on the timeline route,** so selecting a conversation filters by customer and channel only. A customer with two threads on one channel sees the union in the thread pane. Documented in Story 24's Edge Cases; fixing it is a backend change Story 24 is not permitted to make.
- **No message templates, scheduling, or bulk send.** Quick replies remain the only drafting aid, and they still insert text rather than sending it.
- **No attachment support on a dispatched or ingested message.** `TicketAttachment` and `CustomerAttachment` exist and are unrelated; wiring them to a channel message needs a delivery model this work item excludes.
- **No conversation assignment, read/unread state, or per-thread notes.** A conversation is a derived grouping, not a stored entity with its own lifecycle.
- **No real-time updates, no polling.** As above.
- **No customer-facing portal.** Every read route still requires staff permissions; the one public route is machine-to-machine.
- **No automated end-to-end browser test and no visual-regression test.** RTL, responsive, and keyboard behaviour are covered by Story 24's manual Verification Steps, consistent with work items 1–5.
- **No CI/CD.** Excluded by the original intake.

### Environment prerequisites

- Everything work item 5 required: Node.js **24 LTS**, npm 11+, PostgreSQL running, the seeded administrator's password known, `UPLOAD_DIR` and `MAX_UPLOAD_BYTES` present in `apps/api/.env`.
- **One new environment variable:** `COMMUNICATION_INBOUND_SECRET` in `apps/api/.env`. **Optional** — absent means the inbound route returns 503 and nothing else in the feature is affected. When set it must be at least 32 characters, or the API refuses to boot.
- **No new npm dependency, on either side.** `apps/api/package.json` and `apps/web/package.json` must both be unchanged across all three stories — a checkable claim, and the consequence of the no-transport decision. `crypto.timingSafeEqual` is a Node built-in.
- **One new migration**, in Story 22 only. `npm run prisma:migrate`, then `prisma:generate`, then `prisma:seed`, in that order. The seed is mandatory: without it `communication:send` does not exist and Story 23's dispatch route 403s for every role including the administrator.
- **No new browser-storage key.** `crm.locale` remains the only one.
- Story 24's manual verification needs both dev servers and fixture users for the `support-agent` and `reporting-user` roles, plus one customer with an email address and one without.
