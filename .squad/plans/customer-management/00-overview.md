# customer-management — plan overview

Entry point for the **customer-management** feature. Stories execute in order by their `NN` prefix.

Azure DevOps work item **3 — "Customer Management"** is split into four sequential stories. All four share the same tracker id because they deliver one work item; each ends with a stop-and-report gate.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 09 | [09-story-customer-data-model-3.md](09-story-customer-data-model-3.md) | Customer data model: customers, notes, attachments, interactions | 3 | 08 |
| 10 | [10-story-customer-api-3.md](10-story-customer-api-3.md) | Customer API: create, read, update, search, filter, archive | 3 | 09 |
| 11 | [11-story-customer-notes-attachments-interactions-3.md](11-story-customer-notes-attachments-interactions-3.md) | Customer notes, attachments, and interaction history | 3 | 10 |
| 12 | [12-story-frontend-customer-management-3.md](12-story-frontend-customer-management-3.md) | Frontend: customer list, details page, and create/edit forms | 3 | 11 |

## Dependency notes

**Strictly sequential.** Each story ends with a `STOP HERE` gate; do not start the next until the previous one's Done Criteria are met.

- **08 → 09.** The whole feature builds on [work item 2](../authentication-and-user-management/00-overview.md): the identity tables every customer row references, `PermissionsGuard` and `@RequirePermissions()`, `@CurrentUser()`, and the SPA's `apiClient` / auth store / router guard. It builds in turn on [work item 1](../init-porject/00-overview.md): npm workspaces, the NestJS API with its global `ValidationPipe` and `AllExceptionsFilter`, Prisma against PostgreSQL `CustomerCRM`, and the Vue 3 shell.
- **09 → 10, 11, 12.** Story 09 is the **only** story in this feature that creates a migration. Every table and column Stories 10–12 read — `customers`, `customer_notes`, `customer_attachments`, `customer_interactions`, and the four enum types — is created there, and so are the six permission keys. Discovering a missing column in 10 or 11 means revising Story 09 and re-running `prisma migrate dev`, not stacking a second migration.
- **10 → 11.** Story 11's nested routes all live under `/api/customers/:customerId/…` and call `CustomersService.assertExists` before touching a child row. They also reuse Story 10's `USER_REF_SELECT` and `UserRefDto`, so both stories render an embedded user identically.
- **11 → 12.** Story 12's details page consumes all three child collections and depends on Story 11's `Content-Disposition: attachment` behaviour for downloads. Building the frontend before 11 means shipping a profile page with three empty tabs.

### Shared contracts

Changing any of these requires updating every story that references it, in the same commit.

| Contract | Defined in | Consumed by |
|---|---|---|
| The six permission keys (`customers:read`, `customers:write`, `customers:archive`, `notes:write`, `attachments:write`, `interactions:write`) | Story 09 task 6 (`prisma/seed.ts`) | Story 10 and Story 11 (`@RequirePermissions()` on every route); Story 12 (nav visibility, route `meta.permissions`, per-control `auth.can()`) |
| `CustomerStatus`, `CustomerType`, `InteractionChannel`, `InteractionDirection` | Story 09 task 1 (Prisma enums) | Stories 10 and 11 (DTO `@IsEnum`); Story 12 (mirrored as TypeScript string unions in `api/customers.ts`) |
| `CUSTOMER_SELECT` and `USER_REF_SELECT` | Story 10 task 2 | Story 11 (the same user projection on every child); Story 12 (`Customer` and `UserRef` interfaces) |
| `CustomerResponseDto` / `PaginatedCustomersDto` field sets | Story 10 task 1 | Story 12 (`Customer`, `PaginatedCustomers`) |
| The seven list query parameters (`page`, `pageSize`, `search`, `status`, `type`, `assignedAgentId`, `city`) | Story 10 task 1 | Story 12's `ListCustomersParams` — an eighth key is an instant `400` under `forbidNonWhitelisted` |
| The null-versus-absent `PATCH` contract | Story 10 (`'field' in dto`) | Story 12's form, which sends `null` to clear on edit and omits the key on create |
| The archive rule: `customers:archive` gates **both** entering and leaving `ARCHIVED` | Story 10 task 2 (`CustomersService.setStatus`) | Story 12's status select, which offers `ARCHIVED` only to holders and disables the control on an already-archived customer |
| `ALLOWED_MIME_TYPES` and the 10 MB / 20-file limits | Story 11 task 2 and task 5 | Story 12's upload hint text — advisory only; the API is the authority |
| `storageKey` is **never** in an API response | Story 11 task 5 | Story 12 (no client-side path handling exists) |

### Product decisions

Resolved once, in each story's **Product rules (from story)** table. Summarised here so no later story re-litigates them.

- **Customers are archived, never deleted.** `ARCHIVED` is a terminal status and no `DELETE /api/customers` route exists. Deleting would cascade away the notes, attachments, and interaction history this work item exists to preserve — the same reasoning that made Story 07 deactivate users rather than delete them.
- **An archived customer cannot be edited.** Restore it first, and restoring is itself gated on `customers:archive`.
- **`CustomerStatus` is a Prisma enum, not a seeded lookup table** — the opposite of the choice Story 05 made for roles, because the status set is closed and drives code branching, while roles are runtime data an administrator edits.
- **One read key.** `customers:read` covers the customer and all three child collections; there is no `notes:read`.
- **Every agent sees every customer.** Territory- or assignment-scoped row filtering is a feature with real rules and is deliberately excluded.
- **A support agent gets five of the six new keys** (everything but `customers:archive`), because the work item's protagonist is a support agent managing customer profiles.
- **Notes are editable only by their author**, deletable by the author or a holder of `customers:archive`. A `system-administrator` is not exempt from the edit rule: rewriting a note under someone else's byline is what the rule prevents.
- **Interactions are create-and-delete only.** Correcting a log entry means deleting and re-logging, which keeps the intent visible.
- **`occurredAt` may be back-dated freely** but not set more than five minutes ahead — enough to absorb clock skew, not enough to fabricate a future.
- **Attachment bytes live on the filesystem**, metadata in the database. The stored filename is always `randomUUID()` plus an extension from a mime whitelist; the client's filename is display-only and sanitised.
- **Uploads write bytes first, insert the row second**; deletes remove the row first, the file second. The worst failure in either direction is an invisible orphaned file rather than a broken download.
- **Every attachment is served with `Content-Disposition: attachment` and `nosniff`, never inline.** The SPA and the API share an origin through the Vite proxy, so an inline-rendered upload would be stored XSS against the CRM itself. `image/svg+xml` is excluded from the whitelist for the same reason.
- **Downloads go through `apiClient` as a blob**, not a bare `<a href>` — the access token lives in memory (Story 08), so a plain link would `401`.
- **Phone numbers are stored as typed.** No E.164 normalisation, no uniqueness: parsing needs a country context this application does not have.
- **Last write wins on concurrent edits.** There is no optimistic-concurrency token.

### Deliberate scope exclusions

Recorded so later stories do not treat them as oversights.

- **No `Ticket` entity.** The work item's "customer ticket history" is delivered as far as it honestly can be: `customer_interactions` records calls, emails, chats, and meetings, and the profile's History tab carries a verbatim note that tickets will join the same timeline once ticketing ships. Building a ticket model inside a customer story would pre-empt its own work item.
- **No `customer_contacts` child table.** Several named contact persons per company is a genuine B2B need and its own story. This work item stores one set of contact fields on the customer.
- **No customer reference code.** Customers are addressed by uuid. A human-readable `C-000123` needs a Postgres sequence and hand-edited migration SQL for a nicety nothing depends on.
- **No `pg_trgm` index.** Search is `ILIKE`-based and scans sequentially. Correct at this scale; the index is a separate migration when the row count justifies it.
- **No virus scanning, content inspection, thumbnailing, or image resizing.** An `.exe` renamed `.pdf` with a forged content type is accepted. The mitigations that matter are that the file is never executed, never served inline, and always downloaded with `nosniff`.
- **No object storage.** Files land under `UPLOAD_DIR` on local disk. `AttachmentStorageService` is the single seam to swap later.
- **No cleanup job for orphaned files.** Nothing sweeps `UPLOAD_DIR`. Harmless at this scale; an operations concern.
- **No audit log table.** Continuing work item 2's decision: every mutation emits a structured log line carrying `actorId` and `customerId`.
- **No bulk actions, CSV export, or print views.**
- **No end-to-end browser test.** Consistent with work items 1 and 2. Story 12's browser path is covered manually by its Verification Steps 5–18.
- **`/api/docs` and `/api/docs-json` remain unauthenticated.** Inherited from work items 1 and 2, and now more consequential: the schema of real customer data is published. **This must be gated before the first deployment holding customer data.**

### Environment prerequisites

- Node.js **24 LTS** and npm 11+, as recorded for work item 2.
- **PostgreSQL must be running** for Stories 09, 10, and 11 — every e2e spec in them reads or writes real tables.
- The seeded administrator's password must be known from Story 09 onward. `apps/api/.env.example` ships `BOOTSTRAP_ADMIN_PASSWORD`; if a `prisma migrate dev` reset wipes the database, re-run `npm run prisma:seed`.
- **`UPLOAD_DIR` and `MAX_UPLOAD_BYTES` must be in `apps/api/.env` from Story 11 onward.** The API refuses to boot on an invalid value, by design — that failed boot is the first thing to check after Story 11 lands. `apps/api/var/` is gitignored and created on demand.
- **Story 12 needs both dev servers running**, and `apps/web/.env` must keep `VITE_API_BASE_URL` **empty** in development so the refresh cookie and the download flow work through the Vite proxy.
- New dependencies across the whole feature: **`@types/multer` only** (Story 11), types-only with no native build step. `multer` itself is already present at 2.2.0 through `@nestjs/platform-express`. Stories 09, 10, and 12 add none.
