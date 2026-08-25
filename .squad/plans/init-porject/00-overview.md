# init-porject — plan overview

Entry point for the **init-porject** feature. Stories execute in order by their `NN` prefix.

Azure DevOps work item **1 — "Project Setup & Bootstrap"** is split into four sequential stories. All four share the same tracker id because they deliver one work item; each ends with a stop-and-report gate.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-workspace-scaffolding-1.md](01-story-workspace-scaffolding-1.md) | Repository & workspace scaffolding | 1 | — |
| 02 | [02-story-backend-api-bootstrap-1.md](02-story-backend-api-bootstrap-1.md) | Backend API bootstrap: NestJS, validation, logging, Swagger, error handling | 1 | 01 |
| 03 | [03-story-prisma-postgres-migration-1.md](03-story-prisma-postgres-migration-1.md) | Prisma, PostgreSQL `CustomerCRM`, initial migration and seed | 1 | 02 |
| 04 | [04-story-frontend-vue-connectivity-1.md](04-story-frontend-vue-connectivity-1.md) | Frontend Vue 3: router, Pinia, API client, layout and end-to-end connectivity | 1 | 03 |

## Dependency notes

**Strictly sequential.** Each story ends with a `STOP HERE` gate; do not start the next until the previous one's Done Criteria are met.

- **01 → 02, 03, 04.** Story 01 creates the npm workspaces root, the empty `apps/api` and `apps/web` directories, `.editorconfig` (LF endings, needed before any scaffolder runs), and the `.env.example` files that 02–04 consume.
- **02 → 03.** Story 03 extends `HealthService.check`, `HealthResponseDto`, and `validateEnv` — all created in Story 02. It also depends on `app.enableShutdownHooks()` from Story 02, task 8, which is what triggers Prisma's `onModuleDestroy`.
- **03 → 04.** Story 04's UI renders the `database` block and the `503` response that Story 03 adds. Building the frontend against Story 02's health shape means reworking it.

### Shared contracts

Changing any of these requires updating every story that references it, in the same commit.

| Contract | Defined in | Consumed by |
|---|---|---|
| Workspace names `@crm/api`, `@crm/web` | Story 01, task 2 (root `package.json` scripts) | Story 02 task 2; Story 04 task 2 |
| Script names `start:dev` / `dev` / `build` / `test` / `lint` / `typecheck` | Story 01, task 2 (`--workspaces --if-present` fan-out) | Story 02 task 2; Story 04 task 2 |
| `HealthResponseDto` field set | Story 02 task 6, extended by Story 03 task 8 | Story 04 task 5 (`HealthResponse` mirrors it field-for-field) |
| `ErrorResponseBody` envelope (`message` is `string \| string[]`) | Story 02, task 5 | Story 04 task 5 (`toErrorMessage`) |
| Global API prefix `api` + Vite proxy with **no** path rewrite | Story 02 task 8; Story 04 task 3 | both — a rewrite on either side yields `404` |
| Port 3000 (API) / 5173 (web) and `CORS_ORIGINS` | Story 01 task 6; Story 04 task 3 (`strictPort`) | both |

### Stack decisions

The work item's labels contradict its description in two places. Resolved once in Story 01's **Product rules (from story)** and recorded in `docs/adr/0001-stack-decisions.md`:

- **PostgreSQL**, not SQL Server — the `SQLServer` label is stale; the description specifies PostgreSQL and database `CustomerCRM`.
- **NestJS 11** — named only by the label, but the required features (validation, logging, Swagger/OpenAPI, global error handling) map onto NestJS primitives.
- **npm workspaces**, not pnpm — `pnpm` is not installed in the target environment.

### Deliberate scope exclusions

Recorded so later stories do not treat them as oversights:

- **No CRM domain models.** Story 03 ships one infrastructure table (`app_settings`) to exercise the migration and seed pipeline. Modelling customers, tickets, and agents belongs to a later work item; guessing now produces a migration the first domain story has to undo.
- **Swagger UI and the health endpoint's `database.message` are unauthenticated** in every environment (Story 02 edge cases; Story 03 task 8). Acceptable while there is no auth and no real data — both must be gated before the first deployment holding customer data.
- **No SPA fallback configuration.** `createWebHistory` needs the production host to rewrite unknown paths to `index.html` (Story 04 edge cases). The dev server handles it; the deployment story must not.
- **No end-to-end browser test.** The demo path is covered by Story 04, Verification Step 8, manually. Playwright plus a live database is out of scope for the bootstrap.

### Environment prerequisites

- Node.js **24 LTS** and npm 11+. Verified present when planning: `node v24.14.0`, `npm 11.9.0`.
- **PostgreSQL 16+ is required from Story 03 onward.** `psql` was **not** on `PATH` when this plan was written — confirm a reachable server before starting Story 03, as neither its migration nor its verification can complete without one.
- Story 03, task 1 is the highest-risk step in the feature: the database must be created as `CREATE DATABASE "CustomerCRM";` **with double quotes**, or PostgreSQL folds the name to `customercrm` and Prisma cannot connect.
