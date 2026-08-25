# ticket-management — plan overview

Entry point for the **ticket-management** feature. Stories execute in order by their `NN` prefix.

Azure DevOps work item **4 — "Ticket Management"** is split into four sequential stories, the same shape [customer-management](../customer-management/00-overview.md) used for work item 3. All four share tracker id 4; each ends with a stop-and-report gate.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 13 | [13-story-ticket-data-model-4.md](13-story-ticket-data-model-4.md) | Ticket data model: tickets, comments, attachments, history | 4 | 12 |
| 14 | [14-story-ticket-api-4.md](14-story-ticket-api-4.md) | Ticket API: create, read, update, search, filter, status | 4 | 13 |
| 15 | [15-story-ticket-comments-attachments-history-4.md](15-story-ticket-comments-attachments-history-4.md) | Ticket comments, attachments, and history | 4 | 14 |
| 16 | [16-story-frontend-ticket-management-4.md](16-story-frontend-ticket-management-4.md) | Frontend: ticket list, details page, and create/edit forms | 4 | 15 |

## Dependency notes

**Strictly sequential.** Each story ends with a `STOP HERE` gate; do not start the next until the previous one's Done Criteria are met.

- **12 → 13.** Ticket Management is built entirely on top of [work item 3](../customer-management/00-overview.md): a ticket always links to a `Customer` row (`Ticket.customerId`), and Story 15 reuses `CustomersService.assertExists`-style patterns and generalises `AttachmentStorageService`, which work item 3 created. It also inherits everything work item 3 inherited from [work item 2](../authentication-and-user-management/00-overview.md) (`PermissionsGuard`, `@RequirePermissions()`, `@CurrentUser()`) and [work item 1](../init-porject/00-overview.md) (NestJS API, Prisma/PostgreSQL, the Vue 3 shell).
- **13 → 14, 15, 16.** Story 13 is the **only** story in this feature that creates a migration. Every table and column Stories 14–16 read — `tickets`, `ticket_comments`, `ticket_attachments`, `ticket_history`, and the three enum types — is created there, and so are the five new permission keys.
- **14 → 15.** Story 15's nested routes all live under `/api/tickets/:ticketId/…` and call `TicketsService.assertExists` before touching a child table, exactly as Story 11 did for customers. Story 15 also **modifies a Story-11 file**: `AttachmentStorageService` moves from `apps/api/src/customers/` to `apps/api/src/common/` and gains a `folder` parameter so both customer and ticket attachments can share one implementation.
- **15 → 16.** Story 16's details page consumes all three child collections (comments, attachments, history) and depends on Story 15's `Content-Disposition: attachment` download behaviour, same as Story 12 did for customers.

### Shared contracts

Changing any of these requires updating every story that references it, in the same commit.

| Contract | Defined in | Consumed by |
|---|---|---|
| The five permission keys (`tickets:read`, `tickets:write`, `tickets:manage`, `ticket-comments:write`, `ticket-attachments:write`) | Story 13 task 6 (`prisma/seed.ts`) | Story 14 and Story 15 (`@RequirePermissions()` on every route); Story 16 (nav visibility, route `meta.permissions`, per-control `auth.can()`) |
| `TicketCategory`, `TicketPriority`, `TicketStatus` | Story 13 task 1 (Prisma enums) | Stories 14 and 15 (DTO `@IsEnum`); Story 16 (mirrored as TypeScript string unions in `api/tickets.ts`) |
| `TICKET_SELECT`, `CUSTOMER_REF_SELECT`, and the reused `USER_REF_SELECT` (imported from `apps/api/src/customers/customers.service.ts`) | Story 14 task 2 | Story 15 (comments/attachments/history services embed the same user projection); Story 16 (`Ticket`, `CustomerRef`, `UserRef` interfaces) |
| `TicketResponseDto` / `PaginatedTicketsDto` field sets | Story 14 task 1 | Story 16 (`Ticket`, `PaginatedTickets`) |
| The six list query parameters (`page`, `pageSize`, `search`, `category`, `priority`, `status`, `assignedAgentId`, `customerId`) | Story 14 task 1 | Story 16's `ListTicketsParams` — an extra key is an instant `400` under `forbidNonWhitelisted` |
| The null-versus-absent `PATCH /tickets/:id` contract for `assignedAgentId` | Story 14 (`'assignedAgentId' in dto`) | Story 16's form, which sends `null` to unassign on edit and omits the key on create |
| `AttachmentStorageService.save(folder, scopeId, buffer, mimeType)` — generalised, `folder` is `'customers' \| 'tickets'` | Story 15 task 2 (modifies the Story-11 file, moves it to `apps/api/src/common/`) | Story 15's `TicketAttachmentsService`; the existing `apps/api/src/customers/attachments.service.ts` call site is updated in the same task and its storage-key format is unchanged (`customers/<id>/<uuid><ext>` still results when `folder === 'customers'`) |
| `ALLOWED_MIME_TYPES` and the 10 MB / 20-file limits | Reused verbatim from Story 11, no changes | Story 15's ticket attachment upload; Story 16's upload hint text |
| `TicketHistory` rows are written only by `TicketsService.update()` and `TicketsService.setStatus()`, never by a client | Story 14 task 2 | Story 15's `TicketHistoryController` is read-only (`GET` only); Story 16's History tab has no add-form, unlike the customer Interactions tab |

### Product decisions

Resolved once, in each story's **Product rules (from story)** table. Summarised here so no later story re-litigates them.

- **`TicketCategory`, `TicketPriority`, and `TicketStatus` are all Prisma enums, not seeded lookup tables** — the intake lists category, priority, and status as three parallel, equally-weighted bullets with no language distinguishing category as administrator-configurable data (contrast with `Department`/`Branch` in `apps/api/src/org/`, which genuinely are seeded, admin-editable lookup tables with their own CRUD API). All three are closed sets that drive UI badges and workflow, matching the reasoning that made `CustomerStatus` an enum in work item 3.
- **Tickets are never deleted.** `CLOSED` is a normal (non-terminal) status — a closed ticket can be reopened by setting status back to `OPEN` — and no `DELETE /api/tickets` route exists, so comments, attachments, and history always survive.
- **One read key.** `tickets:read` covers the ticket and all three child collections (comments, attachments, history) — there is no `history:read`.
- **`tickets:manage` is the one elevated permission**, granted only to `crm-manager`. It plays the same double role `customers:archive` played in work item 3, except tickets have no archive concept — its only job is authorising deletion of a comment or attachment created by someone else. Deleting **your own** comment or attachment needs only `ticket-comments:write` / `ticket-attachments:write`.
- **Comments are editable only by their author**, deletable by the author or a `tickets:manage` holder — identical rule to `CustomerNote` in work item 3.
- **History is system-generated only.** `TicketHistory` rows are written as a side effect of `TicketsService.update()` (diffing `category`/`priority`/`assignedAgentId`) and `TicketsService.setStatus()` (diffing `status`). There is no `POST`/`PATCH`/`DELETE` route on `TicketHistoryController` — it is `GET` only, mirroring the "create-and-delete-only, no edit" shape of `CustomerInteraction` but going one step further: no user-initiated create either.
- **History entries store raw old/new values** (the enum literal, or the `assignedAgentId` UUID), not resolved display names. Snapshotting a user's name at the moment of a historical change is out of scope; the frontend renders the raw value if a friendlier lookup isn't available.
- **No status-transition gating.** Any `tickets:write` holder can move a ticket to any `TicketStatus` value, in any order, including back out of `RESOLVED`/`CLOSED`. Unlike `CustomerStatus`'s `ARCHIVED`, no status value is treated as sensitive enough to need `tickets:manage`.
- **No edit lock on `CLOSED`/`RESOLVED` tickets.** Unlike an `ARCHIVED` customer, a closed ticket can still be edited via `PATCH /tickets/:id` — the intake does not ask for a terminal-state lock, and reopening-by-status-change already covers the common case.
- **A ticket's `customerId` is immutable after creation.** `UpdateTicketDto` has no `customerId` field. Re-linking a ticket to a different customer is not a requested capability.
- **A support agent gets four of the five ticket permission keys** (everything but `tickets:manage`), mirroring the customer-management grant pattern where `support-agent` and `support-supervisor` receive identical grants for the sibling feature.
- **`AttachmentStorageService` is generalised, not duplicated.** It moves to `apps/api/src/common/attachment-storage.service.ts` and takes an explicit `folder: 'customers' | 'tickets'` parameter. This is a deliberate, minimal change to a Story-11 file rather than a second near-identical service, because the checksum/whitelist/path-containment logic is real duplication risk, not a hypothetical one — the second call site exists in this very feature.
- **The ticket create/edit form gets a customer picker via a new `listCustomerRefs()` helper added to the existing `apps/web/src/api/customers.ts`** (Story 10's file), following the exact precedent Story 12 set by adding `listAgents()` to `apps/web/src/api/users.ts` for the customer form's agent picker.

### Deliberate scope exclusions

Recorded so later stories do not treat them as oversights.

- **No human-readable ticket number** (e.g. `TKT-000123`). Tickets are addressed by uuid, same decision work item 3 made for customers and for the same reason: a sequence-backed reference code needs hand-edited migration SQL for a nicety nothing depends on.
- **No SLA tracking, due dates, or escalation rules.** The `Escalation` label on the work item is not reflected in any field — the intake's bullet list does not mention SLAs or escalation timers, and inventing one would be scope creep beyond "Comments. Attachments. Ticket history."
- **No customer-facing ticket portal.** Every route in this feature requires staff permissions (`tickets:read` at minimum); there is no unauthenticated or customer-role ticket view.
- **No ticket-to-ticket linking, merging, or splitting.**
- **No bulk actions, CSV export, or print views** — consistent with work item 3.
- **No virus scanning, content inspection, thumbnailing, or magic-byte validation on ticket attachments** — inherits work item 3's `ALLOWED_MIME_TYPES` whitelist-by-declared-mime-type approach verbatim.
- **No `pg_trgm` index for search** — `ILIKE`-based search on `subject`/`description`, same deferred-optimisation decision as work item 3.
- **No optimistic concurrency.** Last write wins on concurrent edits, same as customers.
- **No end-to-end browser test.** Story 16's browser path is covered manually by its Verification Steps, consistent with work items 1–3.

### Environment prerequisites

- Everything work item 3 required: Node.js **24 LTS**, npm 11+, PostgreSQL running, the seeded administrator's password known, `UPLOAD_DIR` and `MAX_UPLOAD_BYTES` present in `apps/api/.env`.
- **No new environment variables.** Ticket attachments reuse `UPLOAD_DIR` and `MAX_UPLOAD_BYTES` verbatim through the generalised `AttachmentStorageService` — files land under `<UPLOAD_DIR>/tickets/<ticketId>/…` alongside the existing `<UPLOAD_DIR>/customers/<customerId>/…` tree.
- **No new npm dependencies.** Story 15 reuses `multer`/`@types/multer`, already present from work item 3.
- Story 16 needs both dev servers running, same as Story 12.
