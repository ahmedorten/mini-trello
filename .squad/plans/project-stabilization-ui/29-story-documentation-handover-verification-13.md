# Story 29 — Documentation, repository handover, and full-flow verification (Story: 13)

## Prerequisites

- [Story 25](25-story-backend-list-sorting-indexes-dev-seed-13.md), [Story 26](26-story-frontend-table-shell-sorting-page-size-13.md), [Story 27](27-story-frontend-dialogs-forms-consistency-13.md), and [Story 28](28-story-login-test-user-picker-13.md) all completed. This story documents the system **as it then stands**, so nothing it describes may still be in flight.
- A working local environment: PostgreSQL with the `CustomerCRM` database, both `.env` files populated, the database migrated and seeded with `SEED_DEV_USERS=true`, and both dev servers able to start.
- **This story writes documentation and runs verification. It fixes only defects that the verification pass actually finds** — and each such fix is recorded in the story report, not folded in silently.

---

## Story Goal

Close work item 13 by making the repository handover-ready:

1. **Rewrite `README.md`.** It is **41 lines** today and covers stack, requirements, setup, running, and the four check commands. It says nothing about architecture, the database, environment variables, the permission model, seeding, the dev test users, project structure, or what the application actually does. It is a bootstrap README that six work items have outgrown.
2. **Document the implemented scope, US01–US06,** so a reader can tell what exists without reading the plans.
3. **Document US07–US12 as Future Incoming,** with their purpose and expected scope, and an unambiguous statement that none of it is implemented.
4. **Record the work item 13 decisions as an ADR,** beside the existing `docs/adr/0001-stack-decisions.md`.
5. **Run and record a full end-to-end verification** of every implemented flow, in both languages, at three widths, across three roles.

**Not in scope:** any feature work; any implementation of US07–US12, including stubs, placeholder routes, feature flags, or TODO scaffolding; CI/CD configuration (explicitly excluded by the intake and by every prior work item); a deployment guide for a specific host; API reference prose that duplicates Swagger; screenshots; a CHANGELOG; a licence change; translating the README.

---

## Context — Read These Files First

1. `README.md` — the **whole file, 41 lines.** The workspace table (stack per workspace), Requirements (Node 24 via `.nvmrc`, npm 11+, PostgreSQL 16+, database `CustomerCRM`), Setup (the two `cp .env.example .env` lines), Running (`npm run dev:api` on :3000 with Swagger at `/api/docs`, `npm run dev:web` on :5173, and the note that the Vite proxy removes the need for CORS in development), and Checks (`typecheck`, `lint`, `test`, `build`). **Every fact in it is still true — extend it, do not contradict it.**
2. `docs/README.md` — **5 lines**, pointing at `adr/`.
3. `docs/adr/0001-stack-decisions.md` — the **whole file, 19 lines.** Read the exact structure to copy: `# ADR NNNN — <title>`, then `**Status:**` and `**Context:**` lines, then `## Decisions` as a numbered list, then `## Consequences` as a bullet list. Its three decisions (PostgreSQL over SQL Server; NestJS 11; npm workspaces over pnpm) and its two consequences are the tone to match: short, and each one says *why*.
4. `package.json` (root) — `workspaces: ["apps/*"]`; `engines` requiring Node `>=24.0.0` and npm `>=11.0.0`; the six scripts: `dev:api`, `dev:web`, `build`, `test`, `lint`, `typecheck`, each `--workspaces --if-present` except the two dev ones.
5. `apps/api/package.json` — the script list to document: `start:dev`, `build`, `test`, `test:e2e`, `typecheck`, `lint`, and the seven `prisma:*` scripts (`generate`, `migrate`, `deploy`, `studio`, `seed`, `reset`). Also the `prisma.seed` hook (`ts-node prisma/seed.ts`) and the jest config with `"rootDir": "src"` — which is why `prisma/` has no unit tests.
6. `apps/web/package.json` — `dev`, `build` (`vue-tsc && vite build`), `preview`, `typecheck`, `test`, `test:watch`, `lint`. Dependencies are exactly `vue`, `vue-router`, `pinia`, `axios`, `vue-i18n` — **five**, and the README should say so, because "no component library, no CSS framework, no icon package" is a real property of this codebase.
7. `apps/api/.env.example` — the **whole file, as Story 25 left it.** Every variable, in order, with its comment: `NODE_ENV`, `PORT`, `DATABASE_URL` (and the note that `CustomerCRM` must be created with double quotes), `CORS_ORIGINS`, `LOG_LEVEL`, `BOOTSTRAP_ADMIN_EMAIL`/`_PASSWORD`, `SEED_DEV_USERS`/`SEED_DEV_USER_PASSWORD`, `JWT_ACCESS_SECRET`/`_TTL`, `JWT_REFRESH_TTL_DAYS`, `UPLOAD_DIR`, `MAX_UPLOAD_BYTES`, `COMMUNICATION_INBOUND_SECRET`. The README's environment table is derived from this file — read it rather than remembering it.
8. `apps/web/.env.example` — `VITE_API_BASE_URL` and, after Story 28, `VITE_DEV_TEST_USER_PASSWORD`.
9. `apps/api/src/config/env.validation.ts` — the **whole file, 116 lines.** `NodeEnv` 15–19, `LogLevel` 21–28, `EnvironmentVariables` 30–95, `validateEnv` 97–116. This is the authority on which variables the **API** validates at boot; the seed-only variables are deliberately absent, and the README must say which are which.
10. `apps/api/prisma/schema.prisma` — **19 models and 9 enums.** For the schema section, list the models by domain: identity (`User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `RefreshToken`), organisation (`Department`, `Branch`, `AppSetting`), customers (`Customer`, `CustomerNote`, `CustomerAttachment`, `CustomerInteraction`), tickets (`Ticket`, `TicketComment`, `TicketAttachment`, `TicketHistory`), work (`AgentTask`, `QuickReply`). Verify the list against the file rather than trusting this sentence.
11. `apps/api/prisma/migrations/` — **six** migrations, plus the one Story 25 added: `20260825114240_first_migration`, `20260825130849_identity_and_rbac`, `20260825174608_customers_notes_attachments_interactions`, `20260825194159_tickets_comments_attachments_history`, `20260826084752_agent_workspace_tasks_quick_replies`, `20260827101500_communication_channels`, and `<timestamp>_list_sort_indexes`. The names map onto the work items; that mapping is worth a table.
12. `apps/api/prisma/seed.ts` — **30 permission keys** in the `permissions` array (40–71), **six roles** in the `roles` array (73–177) with their grants, two departments, one branch, ten quick replies, the bootstrap admin, and Story 25's three dev users. The README's permission-model section is derived from here.
13. `apps/api/src/main.ts` — the **whole file, 78 lines.** `setGlobalPrefix('api')` at 25 (so every route is `/api/…`), the global `ValidationPipe` 27–34, `AllExceptionsFilter` 36, CORS 38–40, and the Swagger document 42–71 with its **seventeen** tags — that tag list is the cheapest accurate summary of the API surface, and it belongs in the README.
14. `apps/web/src/router/index.ts` — the **eighteen** route records at 15–121, each with `meta.titleKey` and most with `meta.permissions`. This is the authoritative screen list for the "what the app does" section.
15. The six feature overviews, which are the source for the US01–06 section — read each one's opening paragraph and its **Product decisions** section: [`init-porject`](../init-porject/00-overview.md), [`authentication-and-user-management`](../authentication-and-user-management/00-overview.md), [`customer-management`](../customer-management/00-overview.md), [`ticket-management`](../ticket-management/00-overview.md), [`agent-dashboard-and-collaboration-and-enhancement-ui`](../agent-dashboard-and-collaboration-and-enhancement-ui/00-overview.md), [`communication-channels`](../communication-channels/00-overview.md). The last one's **Deliberate scope exclusions** list is especially important: it is the honest account of what the communication layer does *not* do, and the README must not overstate it.
16. `.gitignore` — the `# --- Project ---` block. `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.env` and `.env.*` with `!.env.example` exceptions, logs, editor files. Confirm nothing that must not be committed is committed, as part of the handover check.
17. `apps/api/var/uploads/` — attachment bytes written at runtime. Confirm this path is ignored and that no uploaded file is tracked in git. There is at least one uploaded fixture on disk (`var/uploads/customers/ea083f2e-…`); it must not be in the repository.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **The README describes what is true, verified by running it.** Every command in it is executed on a clean checkout before the story is done. | A setup section that has not been followed from scratch is the single most common defect in a handover README, and the one that costs the recipient the most. |
| 2 | **US07–US12 are documented in one clearly marked section, with no implementation of any kind** — no route, no stub, no feature flag, no TODO scaffold, no migration, no translation key. | "No implementation of these stories should be performed as part of this User Story." A stub is implementation: it has to be reviewed, tested, and eventually deleted or finished. |
| 3 | **US07–US12 are described at the level the intake gives them** — a title and a purpose — and are **not** designed. | Writing a design for unbuilt scope makes it look decided. The next person to pick up US07 should find a title they can plan against, not a plan somebody else made without the requirements. |
| 4 | **Known limitations get their own section, and it is honest.** | The communication layer sends nothing on any channel; there is no rate limiting on the public inbound route; sort state is not in the URL; Arabic search does not normalise alef variants or diacritics; there is no self-service password change; there is no CI/CD. Every one of these is a deliberate, recorded decision. A handover that hides them transfers surprises instead of a system. |
| 5 | **Environment variables are documented in a table that distinguishes API-validated from seed-only.** | `apps/api/src/config/env.validation.ts` throws at boot on a bad value for the first group and knows nothing about the second. Somebody who adds `SEED_DEV_USERS` to a production deployment expecting the API to reject it would be wrong in the most consequential possible direction. |
| 6 | **The dev test-user section states the seeding prerequisite, the password-must-match rule, and the fifteen-minute lockout.** | `auth.service.ts:7–8` locks an account for fifteen minutes after five failed attempts. A `VITE_DEV_TEST_USER_PASSWORD` that does not match `SEED_DEV_USER_PASSWORD` locks all three personas in under a minute of clicking, and the symptom ("invalid credentials" for a password the developer believes is right) does not point at the cause. |
| 7 | **The new ADR records work item 13's decisions and nothing else.** It does not restate ADR 0001. | An ADR is a record of a decision and its consequences at a point in time. Rewriting an accepted one is how the history stops being a history. |
| 8 | **The verification pass is recorded as a checklist with results, not as a claim that it was done.** A flow that could not be exercised is marked as such, with the reason. | "End-to-end core flows are verified" is only checkable if the record says which flows, in which language, at which width, as which role. An unrecorded pass is indistinguishable from no pass. |
| 9 | **A defect found during verification is either fixed in this story and named in the report, or filed in the Known limitations section.** It is never left undocumented. | This is the last story in the work item; there is no later one to catch it. |
| 10 | **No CI/CD file is added** — no `.github/workflows`, no pipeline YAML, no Docker artefact. | Excluded by the original intake and by the acceptance criteria ("No CI/CD implementation is introduced"). The check commands in the README are what a future pipeline would run; documenting them is the whole of what is wanted here. |

---

## Implementation tasks

**No backend changes required** beyond any defect fix that task 6 turns up. **No frontend changes required** on the same terms.

### 1 — `README.md`

**File: `README.md`** — rewrite. Keep every existing fact; add the missing sections. Structure:

1. **Title and one-paragraph summary.** What the system is: a customer-support CRM with authentication and RBAC, customer profiles with notes/attachments/interactions, support tickets with comments/attachments/history, an agent dashboard and workspace with tasks and quick replies, and a multi-channel communication timeline with inbound ingestion. Say plainly that channel **delivery** is not implemented (Product rule 4).
2. **Status.** Implemented scope is US01–US06; US07–US12 are future. One line, with links to the two sections below.
3. **Tech stack.** Keep and extend the existing workspace table. Add: NestJS 11, Prisma 6, PostgreSQL, `class-validator`, `nestjs-pino`, `@nestjs/swagger`, `@nestjs/jwt` on the API; Vue 3 + Vite 5 + Pinia + Vue Router + `vue-i18n` on the web. State that `apps/web` has exactly **five** runtime dependencies and that the design system, icon set, and RTL support are hand-rolled in-repo — no component library, CSS framework, or icon package.
4. **Repository layout.** A tree to two levels: `apps/api/src` by module directory, `apps/api/prisma`, `apps/web/src` (`api/`, `assets/`, `components/`, `i18n/`, `layouts/`, `router/`, `stores/`, `test/`, `utils/`, `views/`), `docs/`, `.squad/`. One line each.
5. **Architecture.** How a request flows: browser → Vite proxy (dev) or `VITE_API_BASE_URL` → `/api` global prefix → `JwtAuthGuard` → `PermissionsGuard` → controller → service → Prisma → PostgreSQL, with `ValidationPipe` on the way in and `AllExceptionsFilter` on the way out. Then the auth model in four sentences: a short-lived access token in memory only, a rotating refresh token in an httpOnly cookie, replay of a consumed refresh token revoking every session, and permissions resolved from role grants at login. Cite the files, do not restate their code.
6. **Prerequisites.** Node 24 LTS (`.nvmrc`/`.node-version`), npm 11+, PostgreSQL 16+.
7. **Setup, end to end** — the section a new developer follows verbatim:
   ```bash
   npm install
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
   Then, with an explicit note that the database name is case-sensitive:
   ```sql
   CREATE DATABASE "CustomerCRM";
   ```
   Then, from `apps/api`, in this order — and say why the order matters:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```
   State that the seed prints the generated bootstrap-admin password **once** when `BOOTSTRAP_ADMIN_PASSWORD` is unset, and that a re-run never resets an existing password.
8. **Running.** Keep the existing two commands, ports, Swagger URL, and the Vite-proxy/CORS note.
9. **Environment variables.** Two tables (Product rule 5). **API, validated at boot** by `src/config/env.validation.ts`: variable, required/optional, default, what it does. **Seed-only**, read by `prisma/seed.ts` and unknown to the API: `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `SEED_DEV_USERS`, `SEED_DEV_USER_PASSWORD`. Then the web table: `VITE_API_BASE_URL`, `VITE_DEV_TEST_USER_PASSWORD`, with the warning that every `VITE_` variable is readable by anyone holding the built bundle.
10. **Database.** The nineteen models grouped by domain; the migration table mapping each migration to its work item; the `prisma:*` scripts and what each is for; a warning that `prisma:reset` drops data.
11. **Roles and permissions.** The six seeded roles with a one-line description each, and the statement that the thirty permission keys live in `prisma/seed.ts` and are re-granted on every seed run — so removing a key from that file revokes it. Note that the `customer` role holds **zero** permissions by design, which is why a customer sign-in sees almost no navigation.
12. **Development test users.** The three personas, their roles, the `SEED_DEV_USERS`/`SEED_DEV_USER_PASSWORD`/`VITE_DEV_TEST_USER_PASSWORD` triple and the requirement that the last two match, the fact that the picker exists only in development builds and cannot be enabled in a production one, and the **fifteen-minute lockout after five failed attempts** (Product rule 6).
13. **Internationalisation.** Two locales; `en` LTR and `ar` RTL; direction switched at runtime with no reload; the locale persisted under `crm.locale`, the **only** browser-storage key the app writes; the catalogues at `apps/web/src/i18n/locales/` with identical key sets enforced by `i18n.spec.ts`; Arabic rendered with Western digits, deliberately.
14. **Checks.** Keep the four root commands; add `npm run test:e2e` from `apps/api` and note that it needs a running, seeded database. State the current baselines as of this story: **API 34 suites / 406 tests; web 50 files / 523 tests** — plus whatever Stories 25–28 added. Verify the numbers by running them; do not copy these.
15. **Implemented scope (US01–US06)** — task 2.
16. **Future Incoming (US07–US12)** — task 3.
17. **Known limitations** — task 4.
18. **Where the plans live.** `.squad/plans/` with one folder per work item, and `.squad/plans/00-index.md` as the entry point.

### 2 — Implemented scope, US01–US06

A subsection per work item: what it delivered, the routes or screens a reader can visit, and the key constraint. Derive each from that feature's `00-overview.md` (Context item 15), not from memory.

- **US01 — Project Setup & Bootstrap.** npm workspaces, NestJS 11 + Vue 3 scaffolds, PostgreSQL via Prisma, health endpoint, Swagger, global validation, logging, error filter. Screen: `/system-status`.
- **US02 — Authentication & User Management.** JWT access token plus rotating refresh cookie, five-attempt lockout, RBAC with thirty permissions across six roles, user CRUD, role assignment, password reset by an administrator. Screen: `/users`. **Limitation:** there is no self-service password-change screen — `AppLayout`'s `mustChangePassword` banner is informational, and Story 07 deferred the endpoint.
- **US03 — Customer Management.** Customer profiles with type and status, search and filters, notes, file attachments, logged interactions, an archive flow gated on `customers:archive`. Screens: `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`.
- **US04 — Ticket Management.** Tickets with category, priority, status, and assignment; comments; attachments; an audit trail of tracked field changes. Screens: `/tickets`, `/tickets/new`, `/tickets/:id`, `/tickets/:id/edit`.
- **US05 — Agent Dashboard & Collaboration.** Aggregated dashboard counts and queues, the single-ticket agent workspace, agent tasks with due dates and reminders, per-locale quick replies, reassignment. Screens: `/`, `/workspace`, `/workspace/:id`, `/tasks`.
- **US06 — Communication.** A per-channel adapter abstraction with five named implementations, a delivery lifecycle on the stored interaction, authenticated inbound ingestion with idempotency on `(channel, externalId)`, a cross-customer unified timeline, and a conversation view. Screen: `/communication`. **Limitation, stated plainly:** no channel has a configured provider, every dispatch is recorded as `LOGGED`, and nothing is actually sent. The seam is built and tested; the transport is not.
- **US 6.5 — this work item.** Deterministic list sorting with page-size selection, one shared table shell, consistent form controls, an in-app confirmation dialog replacing nine native `window.confirm` calls, the development test-user picker, seven new indexes, and this documentation.

### 3 — Future Incoming, US07–US12

One clearly marked section. Open it with an unambiguous statement:

> **None of the following is implemented.** There is no code, no route, no database column, no translation key, and no feature flag for any of it in this repository. Each entry is a title and a purpose, at the level the original work items state it — deliberately not a design (see ADR 0002).

Then one short entry each: **US07 — SLA & Automation**; **US08 — Knowledge Base & Customer Portal**; **US09 — Notifications & Integrations**; **US10 — AI Support**; **US11 — Reports & Management Dashboard**; **US12 — Security, Administration & Final UI**. Two or three sentences apiece: the purpose, and where in the existing code it would most likely attach — for example, US09's outbound notifications would attach to the existing `ChannelAdapter.dispatch()` seam, and US11's reports to the existing `reports:read` permission, which is seeded and granted to three roles but gates **no** endpoint today. Naming the attachment point is useful; designing the feature is not (Product rule 3).

Verify that `reports:read` claim against `prisma/seed.ts` and a grep for `reports:read` in `apps/api/src/` before writing it.

### 4 — Known limitations

A single honest list, each item one line, each traceable to a recorded decision:

- No outbound delivery on any communication channel; every dispatch is stored as `LOGGED`.
- No rate limiting anywhere, including on the public inbound-ingestion route.
- No webhook signature verification beyond a shared secret — no HMAC, no per-sender key, no replay window.
- No self-service password change; an administrator resets passwords.
- No real-time updates and no polling anywhere; screens refresh on mount, on filter change, and on explicit action.
- Arabic search does not normalise alef variants or diacritics; search is a case-insensitive `contains`.
- List sort and filter state is not in the URL, so a filtered or sorted list is not shareable by link.
- The unified timeline has no `threadKey` filter, so selecting a conversation filters by customer and channel only.
- No attachment support on a dispatched or ingested channel message.
- No CI/CD, no container image, no deployment automation.
- No automated end-to-end browser test and no visual-regression test; RTL, responsive, and keyboard behaviour are verified manually (task 6).

Cross-check this list against the **Deliberate scope exclusions** section of [`communication-channels/00-overview.md`](../communication-channels/00-overview.md) and add anything it lists that is still true.

### 5 — `docs/` and the ADR

**File: `docs/README.md`** — extend the five lines to also point at the README's architecture section and at `.squad/plans/00-index.md`, so `docs/` is a signpost rather than a dead end.

**Create file: `docs/adr/0002-work-item-13-stabilisation-decisions.md`** — match `0001`'s structure exactly (`# ADR 0002 — …`, `**Status:** accepted`, `**Context:**`, `## Decisions` numbered, `## Consequences` bulleted). Record, one numbered decision each with its reason:

1. Sorting is opt-in with a per-resource whitelist enum; no sort parameter reproduces the pre-existing ordering.
2. Every list ordering ends in `{ id: 'asc' }`, fixing non-deterministic pagination on the ticket list.
3. Indexes were added to back the default and sortable orderings; no other schema change was made.
4. One global `.data-table` class rather than a generic table component, because four tables share a shell but not their cells.
5. `window.confirm` was replaced everywhere at once, reversing Story 20's Product rule 16, because two confirmation mechanisms are worse than one poor one.
6. Form controls are styled by element selector in `main.css`, because only two of roughly a dozen files styled them and a class-based fix stays broken for the next file added.
7. The login test-user picker is gated on `import.meta.env.DEV` only, with no runtime flag, so it is *excluded from* rather than *disabled in* production builds.
8. Dev test-user seeding is opt-in and refuses to run with `NODE_ENV=production`.
9. US07–US12 are documented but not designed.

Consequences to record: a fifth sort field cannot be added without also adding the enum member and considering an index; the shared table classes are now global, so a change to `.data-table` affects four screens at once; and reversing decision 5 would mean revisiting nine destructive actions.

### 6 — Full-flow verification, recorded

Run the matrix below and record the result of each cell. Put the record in the story report; if a flow cannot be exercised, say which and why (Product rule 8).

**Roles:** `dev.admin@crm.local` (System Administrator), `dev.agent@crm.local` (Support Agent), `dev.customer@crm.local` (Customer).
**Languages:** `en` (LTR) and `ar` (RTL).
**Widths:** 320px, 768px, 1200px.

Flows, as the administrator unless stated:

1. **Auth.** Sign in via the test-user picker; sign in by typing credentials; a wrong password shows an error; sign out; a protected URL while signed out redirects to `/login?redirect=…` and returns there after signing in; an absolute-URL `redirect` falls back to `/`.
2. **Authorization.** As the Support Agent, `/users` is not in the navigation and a direct visit is refused. As the Customer, only Dashboard and System Status appear and every other direct URL is refused.
3. **Customers.** List, search, filter by status and type, sort by each sortable column, change the page size, create, view, edit, add and delete a note, upload/download/delete an attachment, log an interaction, archive.
4. **Tickets.** List, search, all four filters, sort by each sortable column, change the page size, create, view, edit, change status, assign and reassign, comment, delete a comment, upload and delete an attachment, read the history trail.
5. **Dashboard and workspace.** `/` renders its counts and queues; `/workspace` lists workable tickets; `/workspace/:id` shows the ticket with its comments, attachments, tasks, timeline, and quick replies; a quick reply inserts text without sending.
6. **Tasks.** List, filter by scope/status/overdue, sort, change the page size, create, edit, complete, reopen, delete via the new confirmation dialog.
7. **Communication.** `/communication` lists conversations, opens one, filters, paginates; the composer respects the selected channel's capabilities; sending records an interaction with `LOGGED` and the no-provider notice is visible; the delivery badge renders.
8. **Every confirmation dialog** — all nine sites from Story 27 — opens, cancels harmlessly, confirms correctly, and returns focus.
9. **Language and direction.** Switch to Arabic on the login screen and on an authenticated screen. Confirm the interface language and `document.documentElement.dir` both change with no reload and **without losing the session**. Walk every screen: sidebar, navigation, tables, forms, cards, dialogs, buttons, icons, dashboard tiles. Confirm sort arrows do not mirror and pagination chevrons do. Reload and confirm the locale persisted.
10. **Responsive.** Every screen at all three widths. The nav becomes a drawer below 900px and closes on `Escape` and on route change; tables scroll inside their own container; filter bars wrap; the page body never scrolls horizontally.
11. **States.** Loading, empty, error, and validation states on each list and form. Force an error by stopping the API mid-session and confirm each screen shows a message rather than a blank panel or a stale list beside an error.
12. **Keyboard and accessibility.** Skip link first in the tab order; every control reachable and operable; visible focus ring everywhere; dialogs trap focus and restore it; `aria-current` on the active nav item; `aria-sort` on the active column header. Check the browser console for the `AppButton` icon-only warning on every screen — it must not appear.

### 7 — Repository handover check

- `git status` is clean; nothing under `apps/api/var/uploads/`, no `.env`, no `dist/`, no `coverage/`, and no `*.tsbuildinfo` is tracked. `git ls-files apps/api/var` must return nothing.
- Both `.env.example` files are complete and current; both are tracked.
- From a fresh clone into a new directory, follow the README's setup section verbatim and confirm the app runs (Product rule 1). This is the single most valuable step in the story.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass from the root.
- `.squad/plans/00-index.md` lists all seven feature folders including this one.
- No `.github/`, no pipeline YAML, no Dockerfile has appeared (Product rule 10).

---

## Edge Cases & Failure Modes

- **The README's setup steps do not work on a clean machine** → this is the defect the story exists to catch. Fix the README, or fix the code if the code is wrong, and record which in the report. Do not adjust the steps to match what your already-configured machine happens to do.
- **`prisma:migrate` fails because the database does not exist** → the README must show the `CREATE DATABASE "CustomerCRM";` step, with the double quotes and a note that the name is case-sensitive. `apps/api/.env.example` already carries this warning; the README currently does not.
- **`prisma:seed` before `prisma:migrate`** → fails on missing tables. The README states the order and says why.
- **`prisma:seed` run twice** → idempotent; it prints "already exists; password left unchanged" for the bootstrap admin and each dev user. The README must say so, or the second run's output reads like a failure.
- **The bootstrap-admin password was printed once and lost** → there is no recovery path short of deleting the user row and re-seeding, or resetting the password with `prisma:studio`. Document it; this is the most likely first-day problem for the recipient.
- **`VITE_DEV_TEST_USER_PASSWORD` does not match `SEED_DEV_USER_PASSWORD`** → all three personas lock after five clicks, for fifteen minutes, with an error message that does not name the cause. Product rule 6; document it beside the variables.
- **`JWT_ACCESS_SECRET` shorter than 32 characters** → the API refuses to boot with `Invalid environment configuration: …` from `validateEnv`. Document that env failures are boot-time and loud, and that the message names the constraint.
- **`COMMUNICATION_INBOUND_SECRET` unset** → the inbound route returns **503**, deliberately distinct from the **401** a wrong secret gets. Document both, and that the variable is optional.
- **A verification flow is blocked by a real defect** → Product rule 9: fix it and name it, or file it under Known limitations. Do not quietly narrow the matrix.
- **Documenting a limitation that has since been fixed** → the limitation list is cross-checked against the code, not copied from the earlier overviews. Story 26 put sort state out of the URL; Story 27 removed `window.confirm`. Verify each line before writing it.
- **Scope creep into US07–US12** → any file created under a name suggesting SLA, knowledge base, notifications, AI, or reports is a violation of Product rule 2, regardless of how small. The section is prose in `README.md` and nothing else.
- **Test counts in the README going stale** → they will. Label them "as of work item 13" with the commands that reproduce them, so a reader knows how to re-derive rather than trusting a number.

---

## Test Plan

1. **No new automated tests are added by this story**, and none is removed. It changes documentation only, except for any defect fix task 6 turns up — and a defect fix **must** come with a regression test in the appropriate spec file, following the conventions of that file.
2. **Existing suites are the gate:** `npm run test` from the root must pass for both workspaces, at or above the counts Story 28 left them at.
3. **`npm run test:e2e` from `apps/api`** must pass against a migrated, seeded database. Record the suite and test counts in the report.
4. **The README's own commands are the test.** Execute every command block it contains, in order, on a fresh clone. A command that does not work as written is a failing test of this story.
5. **Markdown links are checked by hand:** every relative link in `README.md`, `docs/README.md`, and both ADRs resolves to a file that exists.
6. **If a defect fix touches `apps/api`,** re-run its unit and e2e suites; if it touches `apps/web`, re-run `vitest` and `vue-tsc`.

---

## Verification Steps

1. **Repository checks:** from the root, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. All four exit 0.
2. **Backend e2e:** from `apps/api`, `npm run test:e2e`. Exits 0.
3. **Fresh-clone setup:** clone into a new directory, follow `README.md` from the top with no other knowledge, and reach a signed-in dashboard. Record every step that needed a correction.
4. **Frontend runs:** `npm run dev:api` and `npm run dev:web`; `http://localhost:5173` and Swagger at `http://localhost:3000/api/docs` both load.
5. **Full-flow matrix:** execute task 6 in full and attach the completed checklist to the story report — twelve flows × three roles where applicable × two languages × three widths, with each cell marked pass, fail, or not-applicable-and-why.
6. **Handover check:** execute task 7. `git status` clean, `git ls-files apps/api/var` empty, no CI/CD artefact present.
7. **Environment tables are accurate:** compare the README's tables line by line against `apps/api/.env.example`, `apps/web/.env.example`, and `src/config/env.validation.ts`. Every variable appears exactly once, in the correct table.
8. **Scope statement is accurate:** for each of US07–US12, grep the repository for its obvious keywords (`sla`, `knowledge`, `notification`, `portal`, `report` beyond the seeded `reports:read` permission) and confirm no implementation exists to contradict the README's claim. Record what `reports:read` actually gates today.
9. **Documentation links resolve:** open each relative link in the four documentation files.
10. **Test-count claims:** re-run both suites and confirm the numbers written in the README match, then confirm the README says they are "as of work item 13" and gives the commands.

---

## Done Criteria

- [ ] `README.md` is rewritten and covers, at minimum: summary, status, stack, repository layout, architecture and the auth model, prerequisites, complete setup including `CREATE DATABASE "CustomerCRM"`, running, both environment-variable tables with the API-validated/seed-only split, database and migration tables, roles and permissions, development test users with the lockout warning, internationalisation, check commands with current baselines, US01–06, US07–12, known limitations, and where the plans live.
- [ ] Every command in `README.md` has been executed on a fresh clone, in order, and works as written.
- [ ] US01–US06 are each documented with what they deliver, the screens they add, and their real limitations — including that no communication channel sends anything and that there is no self-service password change.
- [ ] US07–US12 are documented in a clearly marked Future Incoming section that opens by stating none of it is implemented, describes each at title-and-purpose level, and designs none of it.
- [ ] A Known limitations section exists, is cross-checked against the code rather than copied from the earlier overviews, and includes the no-delivery, no-rate-limiting, no-CI/CD, and no-URL-sort-state items.
- [ ] `docs/README.md` points at the README's architecture section and at `.squad/plans/00-index.md`.
- [ ] `docs/adr/0002-work-item-13-stabilisation-decisions.md` exists, matches ADR 0001's structure, records the nine decisions from task 5 with their reasons, and does not restate ADR 0001.
- [ ] The full-flow verification matrix from task 6 is complete and recorded, with every cell marked and every non-applicable cell explained.
- [ ] Every defect the verification pass found is either fixed with a regression test and named in the report, or recorded under Known limitations.
- [ ] `git status` is clean; no `.env`, `dist/`, `coverage/`, `*.tsbuildinfo`, or uploaded file is tracked; `git ls-files apps/api/var` returns nothing; both `.env.example` files are complete and tracked.
- [ ] No CI/CD file, pipeline definition, or container artefact was added.
- [ ] No file exists anywhere in the repository that implements, stubs, or flags any part of US07–US12.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` pass from the root, and `npm run test:e2e` passes from `apps/api`.
- [ ] `.squad/plans/00-index.md` lists the `project-stabilization-ui` feature folder.

**Work item 13 is complete when this story's Done Criteria are met. Report to the user.**
