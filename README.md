# Customer Support CRM

A customer-support CRM: authentication and role-based access control, customer
profiles with notes/attachments/logged interactions, support tickets with
comments/attachments/an audit trail, an agent dashboard and ticket workspace
with tasks and quick replies, and a multi-channel communication timeline with
authenticated inbound ingestion. **Channel delivery is not implemented** — every
outbound "send" is recorded as a logged interaction; no email, SMS, WhatsApp,
chat, or phone message is ever actually dispatched. See [Known limitations](#known-limitations).

## Status

Implemented: [US01–US06](#implemented-scope-us01us06). Not implemented, not designed:
[US07–US12](#future-incoming-us07us12).

## Tech stack

| Workspace | Path | Stack |
|---|---|---|
| `@crm/api` | `apps/api` | NestJS 11, TypeScript, Prisma 6, PostgreSQL, `class-validator`, `nestjs-pino`, `@nestjs/swagger`, `@nestjs/jwt` |
| `@crm/web` | `apps/web` | Vue 3, TypeScript, Vite 5, Pinia, Vue Router, `vue-i18n` |

`apps/web` has exactly **five** runtime dependencies (`vue`, `vue-router`, `pinia`,
`axios`, `vue-i18n`). The design system, icon set, and RTL support are all
hand-rolled in-repo — no component library, no CSS framework, no icon package.

## Repository layout

```
apps/api/src/        one directory per Nest module: auth, users, roles, org,
                      customers, tickets, dashboard, tasks, quick-replies,
                      communication, health, common (guards/filters/pipes)
apps/api/prisma/      schema.prisma, migrations/, seed.ts
apps/web/src/
  api/                axios client + one module per resource
  assets/             main.css — the global design tokens and form-control rules
  components/         AppButton, AppModal, AppConfirmDialog, AppSortHeader, …
  i18n/               en.json / ar.json locale catalogues
  layouts/            AppLayout — sidebar, header, mobile drawer
  router/             route table and the auth/permission guard
  stores/             Pinia stores, one per resource
  test/               Vitest setup
  utils/              formatting helpers
  views/              one component per screen
docs/                 architecture notes and ADRs
.squad/plans/         the work-item plans this codebase was built from
```

## Architecture

A request: browser → Vite dev proxy (development) or `VITE_API_BASE_URL`
(production) → the API's `/api` global prefix (`main.ts`) → `JwtAuthGuard` →
`PermissionsGuard` → controller → service → Prisma → PostgreSQL. Inbound
payloads pass through a global `ValidationPipe` (`whitelist` +
`forbidNonWhitelisted`); every uncaught error is normalised by
`AllExceptionsFilter`.

Auth, in four sentences: a short-lived JWT access token lives in memory only
(never `localStorage`) and is attached by `apps/web/src/api/client.ts`; a
rotating refresh token sits in an httpOnly cookie and is exchanged for a new
access token by `apps/web/src/stores/auth.ts`'s silent-refresh flow; replaying
an already-consumed refresh token (`apps/api/src/auth/token.service.ts`)
revokes every session for that user, not just the one that replayed it;
permissions are resolved from the caller's role grants at login and re-checked
from the database on every request, so a deactivation or role change takes
effect on the very next request rather than after a token expires.

## Prerequisites

- Node.js 24 LTS (`nvm use` reads `.nvmrc`)
- npm 11+
- PostgreSQL 16+

## Setup, end to end

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Create the database. **The name is case-sensitive** — the double quotes are
required:

```sql
CREATE DATABASE "CustomerCRM";
```

Then, from `apps/api`, in this order:

```bash
npm run prisma:generate   # generates the Prisma client from schema.prisma
npm run prisma:migrate    # applies the migration history, creating every table
npm run prisma:seed       # populates permissions, roles, and the bootstrap admin
```

The order matters: `prisma:seed` writes rows into tables `prisma:migrate`
creates, so seeding before migrating fails on missing tables.

The seed is idempotent — re-running it prints `already exists; password left
unchanged` for the bootstrap admin and for each dev test user rather than
resetting anything. If `BOOTSTRAP_ADMIN_PASSWORD` is unset when the admin is
first created, the seed **generates a random password and prints it exactly
once**; there is no way to recover it afterwards short of resetting the
password via `npm run prisma:studio` or re-seeding a fresh database.

## Running

```bash
npm run dev:api   # http://localhost:3000  — Swagger at /api/docs
npm run dev:web   # http://localhost:5173
```

Run both in separate terminals. The Vite dev server proxies `/api` to the
backend, so no CORS configuration is needed for local development.

## Environment variables

### API — validated at boot (`apps/api/src/config/env.validation.ts`)

A bad value in this group throws `Invalid environment configuration: …` and
the process refuses to start.

| Variable | Required | Default | What it does |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `3000` | HTTP port the API listens on |
| `CORS_ORIGINS` | no | — | Comma-separated browser origins allowed by CORS |
| `LOG_LEVEL` | no | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | **yes** | — | HS256 signing key, ≥ 32 characters |
| `JWT_ACCESS_TTL` | no | `15m` | Access token lifetime (`15m`, `900s`, `1h`, `1d`) |
| `JWT_REFRESH_TTL_DAYS` | no | `7` | Refresh cookie lifetime, whole days, 1–90 |
| `UPLOAD_DIR` | no | `./var/uploads` | Where attachment bytes are written |
| `MAX_UPLOAD_BYTES` | no | `10485760` | Hard ceiling on a single upload (10 MiB) |
| `COMMUNICATION_INBOUND_SECRET` | no | — | Shared secret for `POST /api/communication/inbound/:channel`; ≥ 32 characters when set. **Unset means the route returns 503, not that it accepts unauthenticated writes.** |

### API — seed-only (`prisma/seed.ts`, unknown to the running API)

| Variable | Required | What it does |
|---|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | no (defaults to `admin@crm.local`) | Email of the seeded first administrator |
| `BOOTSTRAP_ADMIN_PASSWORD` | no | Its password. Unset ⇒ a random one is generated and printed once |
| `SEED_DEV_USERS` | no | `true` seeds the three [development test users](#development-test-users). The seed **throws** if this is `true` while `NODE_ENV=production` |
| `SEED_DEV_USER_PASSWORD` | required whenever `SEED_DEV_USERS=true` | Shared password for all three dev accounts. No default |

### Web

| Variable | Required | What it does |
|---|---|---|
| `VITE_API_BASE_URL` | no | API base URL. Leave empty in development to use the Vite proxy |
| `VITE_DEV_TEST_USER_PASSWORD` | no | Prefills the password for the [login test-user picker](#development-test-users), development builds only |

Every `VITE_`-prefixed variable is compiled into the client bundle and is
readable by anyone with the built assets — never put a real secret in one.

## Database

Nineteen models across four domains, in `apps/api/prisma/schema.prisma`:

- **Identity & RBAC** — `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `RefreshToken`
- **Organisation** — `Department`, `Branch`, `AppSetting`
- **Customers** — `Customer`, `CustomerNote`, `CustomerAttachment`, `CustomerInteraction`
- **Tickets & work** — `Ticket`, `TicketComment`, `TicketAttachment`, `TicketHistory`, `AgentTask`, `QuickReply`

### Migrations

| Migration | Work item |
|---|---|
| `20260825114240_first_migration` | US01 — Project Setup & Bootstrap |
| `20260825130849_identity_and_rbac` | US02 — Authentication & User Management |
| `20260825174608_customers_notes_attachments_interactions` | US03 — Customer Management |
| `20260825194159_tickets_comments_attachments_history` | US04 — Ticket Management |
| `20260826084752_agent_workspace_tasks_quick_replies` | US05 — Agent Dashboard & Collaboration |
| `20260827101500_communication_channels` | US06 — Communication Channels |
| `20260827142312_list_sort_indexes` | This work item (list sorting/indexing) |

### `prisma:*` scripts

`generate` (regenerate the client from the schema), `migrate` (create and
apply a new migration in development), `deploy` (apply existing migrations,
no schema diffing — the one to run against a shared database), `studio`
(a local data browser/editor at `localhost:5555`), `seed` (see
[Setup](#setup-end-to-end)). **`prisma:reset` drops every table and re-applies
every migration from zero — it deletes all data.**

## Roles and permissions

Six seeded roles, defined in `prisma/seed.ts`:

| Role | Summary |
|---|---|
| `system-administrator` | Every permission. Full control over users, roles, and organisation structure |
| `crm-manager` | Manages staff accounts, role assignments, and organisation structure; full customer/ticket access |
| `support-supervisor` | Reads staff records and reports; cannot change accounts; full customer/ticket access |
| `support-agent` | Front-line agent: customers, tickets, tasks, communication; no user administration |
| `customer` | External account. **Zero permissions** — a customer sign-in sees almost no navigation, by design |
| `reporting-user` | Read-only: reports, org structure, customers, tickets, dashboard |

The thirty permission keys live in `prisma/seed.ts` and are **re-granted on
every seed run** — removing a key from that file, then re-seeding, revokes it
from every role that held it.

## Development test users

Three seeded accounts, one per persona, gated behind `SEED_DEV_USERS=true` +
`SEED_DEV_USER_PASSWORD`:

| Email | Role |
|---|---|
| `dev.admin@crm.local` | System Administrator |
| `dev.agent@crm.local` | Support Agent |
| `dev.customer@crm.local` | Customer |

The sign-in screen shows a **development-only** picker listing these three
personas; clicking one fills the email/password fields but still requires
pressing Sign in — it does not bypass authentication. The picker exists only
in development builds (`import.meta.env.DEV`), and no environment variable can
switch it back on in a production build — both the persona data and the UI
strings are removed by dead-code elimination, not merely hidden. Set
`VITE_DEV_TEST_USER_PASSWORD` to the **same** value as `SEED_DEV_USER_PASSWORD`,
or the accounts will not authenticate.

**Five failed login attempts locks an account for fifteen minutes**
(`apps/api/src/auth/auth.service.ts`). A `VITE_DEV_TEST_USER_PASSWORD` that
does not match `SEED_DEV_USER_PASSWORD` will lock all three dev personas
within a minute of clicking through them, and the resulting "Invalid email or
password" message does not point at the mismatch as the cause.

## Internationalisation

Two locales, `en` (LTR) and `ar` (RTL), switched at runtime with no page
reload. Direction is driven by CSS logical properties, not a mirrored
`[dir='rtl']` override block. The active locale persists under `crm.locale` —
the **only** key this application writes to browser storage. The catalogues at
`apps/web/src/i18n/locales/en.json` and `ar.json` are required to declare an
identical key set, enforced by `i18n.spec.ts`. Arabic renders with **Western
digits** (`numberingSystem: 'latn'`) throughout, deliberately, so counts and
page numbers stay consistent with the Latin-script identifiers next to them.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

From `apps/api`, additionally:

```bash
npm run test:e2e   # needs a running, migrated, seeded PostgreSQL database
```

**As of this work item** (US 6.5 / US01–US06 complete), reproduce with the
commands above:

- API: 34 suites / 423 unit tests, 17 suites / 328 e2e tests
- Web: 53 files / 606 tests

## Implemented scope (US01–US06)

- **US01 — Project Setup & Bootstrap.** npm workspaces, the NestJS 11 and Vue 3
  scaffolds, PostgreSQL via Prisma, a health endpoint, Swagger, global
  validation, structured logging, and a global error filter. Screen:
  `/system-status`.
- **US02 — Authentication & User Management.** JWT access token plus a
  rotating refresh cookie, a five-attempt/fifteen-minute lockout, RBAC across
  thirty permissions and six roles, user CRUD, role assignment, and
  administrator-driven password reset. Screen: `/users`. **Limitation:**
  there is no self-service password-change screen — `AppLayout`'s
  `mustChangePassword` banner is informational only.
- **US03 — Customer Management.** Customer profiles with type and status,
  search and filters, notes (author-editable, delete gated on
  `customers:archive`), file attachments, logged interactions, and an archive
  flow. Screens: `/customers`, `/customers/new`, `/customers/:id`,
  `/customers/:id/edit`.
- **US04 — Ticket Management.** Tickets with category, priority, status, and
  assignment; comments; attachments; a system-generated audit trail of
  tracked field changes. Screens: `/tickets`, `/tickets/new`, `/tickets/:id`,
  `/tickets/:id/edit`.
- **US05 — Agent Dashboard & Collaboration.** Aggregated dashboard counts and
  queues, a single-ticket agent workspace, agent tasks with due dates and
  reminders, per-locale quick replies, and claim/release/reassignment.
  Screens: `/`, `/workspace`, `/workspace/:id`, `/tasks`.
- **US06 — Communication.** A per-channel adapter abstraction (five named
  implementations), a delivery lifecycle on the stored interaction,
  authenticated inbound ingestion idempotent on `(channel, externalId)`, a
  cross-customer unified timeline, and a conversation view. Screen:
  `/communication`. **Limitation, stated plainly:** no channel has a
  configured provider; every dispatch is recorded as `LOGGED`; nothing is
  actually sent. The seam is built and tested — the transport is not.
- **US 6.5 (this work item).** Deterministic list sorting with page-size
  selection, one shared `.data-table` shell, consistent form-control styling,
  an in-app confirmation dialog replacing nine native `window.confirm` calls,
  the development test-user picker, seven new database indexes, and this
  documentation.

## Future Incoming (US07–US12)

**None of the following is implemented.** There is no code, no route, no
database column, no translation key, and no feature flag for any of it in
this repository. Each entry is a title and a purpose, at the level the
original work items state it — deliberately not a design.

- **US07 — SLA & Automation.** Service-level targets and rules-driven
  automation over tickets. `Ticket` currently carries no SLA field by design
  (see [Known limitations](#known-limitations)); this would need one, plus a
  rule engine or scheduled job to act on breaches.
- **US08 — Knowledge Base & Customer Portal.** Self-service articles and a
  customer-facing portal. Every route in this API currently requires staff
  permissions; a portal would need a separate, much narrower authorization
  surface for customer-role callers.
- **US09 — Notifications & Integrations.** Outbound notifications and
  third-party integrations. The natural attachment point is
  `ChannelAdapter.dispatch()` (`apps/api/src/communication/`) — the seam this
  work item built specifically so a future provider adds an override rather
  than a redesign.
- **US10 — AI Support.** AI-assisted responses or triage. No model client, no
  prompt infrastructure, and no relevant dependency exists anywhere in the
  repository today.
- **US11 — Reports & Management Dashboard.** Cross-cutting reporting beyond
  the existing agent dashboard. The `reports:read` permission is already
  seeded and granted to three roles (`system-administrator`, `crm-manager`,
  `support-supervisor`, `reporting-user`) but **gates no endpoint today** —
  verified by grep; it is the attachment point, not a partial implementation.
- **US12 — Security, Administration & Final UI.** Further administration and
  security hardening beyond what US01–US06 and this work item shipped.

## Known limitations

Cross-checked against the code, not copied from earlier planning documents:

- No outbound delivery on any communication channel; every dispatch is
  stored as `LOGGED`.
- No rate limiting anywhere, including on the public inbound-ingestion route.
- No webhook signature verification beyond a shared secret — no HMAC, no
  per-sender key, no replay window.
- No self-service password change; an administrator resets passwords.
- No real-time updates and no polling anywhere; screens refresh on mount, on
  filter change, and on explicit action.
- Arabic search does not normalise alef variants or diacritics; search is a
  case-insensitive `contains`.
- List sort and filter state is not in the URL, so a filtered or sorted list
  is not shareable by link.
- The unified communication timeline has no `threadKey` filter, so selecting
  a conversation filters by customer and channel only.
- No attachment support on a dispatched or ingested channel message.
- No conversation assignment, read/unread state, or per-thread notes.
- No customer-facing portal; every read route requires staff permissions.
- No CI/CD, no container image, no deployment automation.
- No automated end-to-end browser test and no visual-regression test; RTL,
  responsive, and keyboard behaviour are verified manually.

## Where the plans live

`.squad/plans/` holds one folder per work item, each with a numbered set of
story files. [`.squad/plans/00-index.md`](.squad/plans/00-index.md) is the
entry point and lists every feature folder with its story-number range.
