# Story 01 — Repository & workspace scaffolding (Story: 1)

## Prerequisites

- None. This is the first story in the repository — the working tree currently contains only `.gitignore` and the `.squad/` workspace (verified with `git ls-files`).
- No sibling plan exists yet to use as precedent; `.squad/plans/00-index.md` and `.squad/plans/init-porject/00-overview.md` are still template stubs. This story establishes the layout that Stories 02–04 depend on.
- Node.js **24 LTS** must be on `PATH`. Verified available in this environment: `node v24.14.0`, `npm 11.9.0`. **`pnpm` is not installed** — every command in this feature uses **npm workspaces**.

---

## Story Goal

Create the repository skeleton that the backend, database, and frontend stories build on. After this story the repo is an **npm workspaces monorepo** with two empty-but-declared app slots, shared tooling config, environment-variable conventions, and a root README describing how to run everything.

User-visible outcomes:

1. `npm install` at the repo root succeeds and links both workspaces.
2. `git status` is clean apart from intended files — no `node_modules`, no `.env`, no build output tracked.
3. A developer can read `README.md` and know which commands start which app.

**Not in scope:** any NestJS code (Story 02), any Prisma schema or migration (Story 03), any Vue code (Story 04). This story creates directories, manifests, and config only.

---

## Context — Read These Files First

1. `.squad/config.yaml` — read the whole file (30 lines). Note `project.name` is **"Customer Support CRM"**, `project.primaryLanguage` is **typescript**, and `project.projectRoots` is `["."]`. The root `package.json` `name` and `description` must match `project.name`.
2. `.gitignore` — read the whole file (8 lines). It contains a block delimited by `# Managed by squad-kit — do not edit this block` (line 1) and `# End squad-kit block` (line 8). **Do not modify any line inside that block.** Append new rules **after** line 8 only.
3. `.squad/stories/init-porject/1/intake.md` — the intake for this work item. Read the **Description** and **Acceptance criteria** fenced blocks. Note the `attachments/` folder next to it is **empty** — there is nothing to open.
4. `.squad/plans/init-porject/00-overview.md` — the feature overview table this story set updates.
5. `.squad/README.md` — lines 1–17, the squad-kit workflow. Explains why plan files are treated as read-only during execution.

---

## Product rules (from story)

The intake's labels and description disagree on two points. These decisions are **fixed** for the whole feature; do not revisit them per story.

| Topic | Intake labels say | Intake description says | **Decision for this feature** |
|---|---|---|---|
| Database engine | `SQLServer` | "Database: PostgreSQL" | **PostgreSQL.** The description body is authoritative; the `SQLServer` label is stale. |
| Backend framework | `NestJS` | "Node.js 24 LTS + TypeScript" (no framework named) | **NestJS 11.** The label names it, and the required features — validation, logging, Swagger/OpenAPI, global error handling — map directly onto NestJS pipes, logger, `@nestjs/swagger`, and exception filters. |
| Package manager | not stated | not stated | **npm workspaces.** `pnpm` is not installed in this environment. |

---

## Implementation tasks

### 1 — Create the directory layout

Create these directories (empty for now; later stories fill them):

```
apps/
  api/          # Story 02 — NestJS backend
  web/          # Story 04 — Vue 3 + Vite frontend
docs/           # architecture notes, ADRs
```

Git does not track empty directories. Add a placeholder so the structure survives the first commit:

**Create file: `docs/README.md`**

```markdown
# Docs

Architecture notes and decision records for the Customer Support CRM.

- `adr/` — one file per architectural decision, newest last.
```

Do **not** create placeholder files in `apps/api/` or `apps/web/` — the official scaffolders in Stories 02 and 04 expect to write into those directories and a stray file can make them prompt or refuse.

---

### 2 — Root workspace manifest

**Create file: `package.json`**

```json
{
  "name": "customer-support-crm",
  "version": "0.1.0",
  "private": true,
  "description": "Customer Support CRM — NestJS API + Vue 3 frontend + PostgreSQL",
  "engines": {
    "node": ">=24.0.0",
    "npm": ">=11.0.0"
  },
  "workspaces": [
    "apps/*"
  ],
  "scripts": {
    "dev:api": "npm run start:dev --workspace @crm/api",
    "dev:web": "npm run dev --workspace @crm/web",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

Notes for the executor:

- `private: true` is **required** — npm refuses to enable workspaces on a publishable root package.
- Every root script uses `--if-present` so `npm run build` at the root does not fail while `apps/web` still has no `build` script (it gets one in Story 04).
- The workspace package names `@crm/api` and `@crm/web` are a **shared contract**. Story 02 must name the backend package exactly `@crm/api`; Story 04 must name the frontend exactly `@crm/web`. Changing either name breaks the root scripts above.
- Do **not** add a `packageManager` field pinning pnpm or yarn.

---

### 3 — Pin the Node version

**Create file: `.nvmrc`**

```
24
```

**Create file: `.node-version`**

```
24
```

Both files hold the bare major version so `nvm`, `fnm`, and `asdf`-style tools all resolve the current Node 24 LTS line rather than a pinned patch that ages badly.

---

### 4 — Shared editor and formatting config

**Create file: `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

`end_of_line = lf` matters: this repo is developed on Windows (verified — the working tree is on `win32`). Without it, the NestJS and Vite scaffolders write CRLF and every later diff is noise.

**Create file: `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

**Create file: `.prettierignore`**

```
node_modules
dist
coverage
apps/api/prisma/migrations
.squad
```

`apps/api/prisma/migrations` is ignored because Prisma generates that SQL and reformatting it invalidates the checksum Prisma stores for each migration.

---

### 5 — Extend `.gitignore`

**File: `.gitignore`**

Append the following **after** the existing `# End squad-kit block` line. Leave lines 1–8 byte-for-byte unchanged.

```gitignore

# --- Project ---
node_modules/
dist/
build/
coverage/
*.tsbuildinfo

# Environment — commit only the .example files
.env
.env.*
!.env.example
!.env.*.example

# Logs
*.log
npm-debug.log*

# Editor / OS
.DS_Store
Thumbs.db
.idea/
.vscode/*
!.vscode/extensions.json
```

The `!.env.example` negation must come **after** the `.env.*` rule — gitignore applies the last matching pattern, so reversing the order silently ignores the example files that the whole team needs.

---

### 6 — Environment variable conventions

Environment files live **per app**, not at the root. Prisma resolves `.env` relative to the schema directory, so the API's variables must sit in `apps/api/`.

Create the two example files now so Stories 02–04 have a target to extend. Both are committed; the real `.env` files are gitignored by task 5.

**Create file: `apps/api/.env.example`**

```dotenv
# --- Runtime ---
NODE_ENV=development
PORT=3000

# --- Database (Story 03) ---
# The database name is case-sensitive. See Story 03 for why it must be created
# with CREATE DATABASE "CustomerCRM" — double quotes included.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/CustomerCRM?schema=public"

# --- CORS ---
# Comma-separated list of allowed browser origins.
CORS_ORIGINS=http://localhost:5173

# --- Logging ---
# One of: fatal, error, warn, info, debug, trace
LOG_LEVEL=debug
```

**Create file: `apps/web/.env.example`**

```dotenv
# Vite only exposes variables prefixed with VITE_ to client code.
# Leave this empty in development so requests go through the Vite dev proxy
# defined in apps/web/vite.config.ts (Story 04).
VITE_API_BASE_URL=
```

---

### 7 — Record the stack decisions

**Create file: `docs/adr/0001-stack-decisions.md`**

Record the three decisions from **Product rules (from story)** above so the PostgreSQL-over-SQL-Server choice stays traceable.

```markdown
# ADR 0001 — Stack decisions for the bootstrap

**Status:** accepted
**Context:** Work item 1 (Project Setup & Bootstrap).

## Decisions

1. **PostgreSQL**, not SQL Server. Work item 1's description specifies PostgreSQL and
   database name `CustomerCRM`. The `SQLServer` label on the work item is stale.
2. **NestJS 11** as the backend framework. The description named only "Node.js 24 LTS +
   TypeScript", but the required features (validation, logging, Swagger/OpenAPI, global
   error handling) map onto NestJS primitives, and the work item carries a `NestJS` label.
3. **npm workspaces**, not pnpm. pnpm is not installed on the development machines in use.

## Consequences

- Prisma's provider is `postgresql`; a future move to SQL Server would need a new
  migration history, not a provider swap.
- Root scripts depend on the workspace names `@crm/api` and `@crm/web`.
```

---

### 8 — Root README

**Create file: `README.md`**

The outer fence below is four backticks so the nested command blocks survive; write the file with normal three-backtick fences.

````markdown
# Customer Support CRM

Monorepo for the Customer Support CRM.

| Workspace | Path | Stack |
|---|---|---|
| `@crm/api` | `apps/api` | NestJS 11, TypeScript, Prisma, PostgreSQL |
| `@crm/web` | `apps/web` | Vue 3, TypeScript, Vite, Pinia, Vue Router |

## Requirements

- Node.js 24 LTS (`nvm use` reads `.nvmrc`)
- npm 11+
- PostgreSQL 16+ with a database named `CustomerCRM`

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

## Running

```bash
npm run dev:api   # http://localhost:3000  — Swagger at /api/docs
npm run dev:web   # http://localhost:5173
```

Run both in separate terminals. The Vite dev server proxies `/api` to the backend,
so no CORS configuration is needed for local development.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
````

Keep the table's stack column accurate as Stories 02–04 land; it is the first thing a new developer reads.

---

## Edge Cases & Failure Modes

- **Scaffolder refuses a non-empty directory.** Trigger: `apps/api` or `apps/web` contains a placeholder file when Story 02 / 04 runs the official scaffolder. Expected: directories stay empty in this story. Enforced by task 1 — the placeholder goes in `docs/`, not in the app directories.
- **`.env.example` accidentally ignored.** Trigger: the `!.env.example` negation is placed before `.env.*` in `.gitignore`. Expected: `git check-ignore -v apps/api/.env.example` reports **no match**. Enforced by the ordering note in task 5. Verify it explicitly — a silently-ignored example file is only discovered when a new developer clones and has nothing to copy.
- **squad-kit managed block corrupted.** Trigger: an edit lands inside `.gitignore` lines 1–8. Expected: those 8 lines are unchanged; `git diff .gitignore` shows additions only, all below `# End squad-kit block`. A change inside the block is silently reverted the next time squad-kit runs, which would un-ignore `.squad/secrets.yaml`.
- **CRLF line endings on Windows.** Trigger: files created without `end_of_line = lf` honored, on this `win32` working tree. Expected: `.editorconfig` from task 4 is in place **before** any scaffolder runs, so generated files use LF. If a later diff shows every line of a file changed, this is the cause.
- **npm refuses workspaces.** Trigger: root `package.json` missing `private: true`. Expected: `npm install` exits non-zero with a workspaces error. Enforced by the manifest in task 2.
- **Workspace name drift.** Trigger: Story 02 names the backend package something other than `@crm/api`. Expected: `npm run dev:api` fails with "No workspaces found". The names are called out as a shared contract in task 2 — if a later story must rename, update the root scripts in the same commit.
- **Node version below 24.** Trigger: a developer on Node 20. Expected: `npm install` prints an `EBADENGINE` **warning**, not an error — npm does not enforce `engines` by default. If the team wants a hard failure, add `engine-strict=true` to a root `.npmrc`; that is deliberately **not** done here because it also blocks CI images that report an odd version string.
- **`.env` committed by accident.** Trigger: a developer runs `git add -f apps/api/.env`. Expected: the gitignore rule from task 5 blocks the non-forced path. There is no automated secret scan in this story — that is a follow-up, not a gap to fix here.

---

## Test Plan

This story creates no executable application code, so it has no unit tests. Verify it with the repository-level checks below; they are the smoke tests for the scaffolding.

1. **Smoke — workspace resolution.** Run `npm install` at the repo root. Assert exit code 0, and that `npm ls --workspaces --depth 0` does **not** error (it lists no workspaces yet, because both app directories are still empty — that is the expected pre-Story-02 state).
2. **Smoke — gitignore correctness.** Run `git check-ignore -v apps/api/.env` and assert it matches the `.env` rule. Run `git check-ignore -v apps/api/.env.example` and assert **no match** (exit code 1). This is the single most valuable check in this story.
3. **Smoke — managed block intact.** Run `git diff -- .gitignore` and assert the removed-line count is zero and every added line falls after `# End squad-kit block`.
4. **Smoke — line endings.** Run `git ls-files --eol` and assert the created text files report `w/lf`, not `w/crlf`.
5. **Deferred.** The first real automated tests arrive in Story 02 (`apps/api/test/health.e2e-spec.ts`) and Story 04 (Vitest component and store tests). Do **not** add a test runner to the root manifest in this story — each workspace brings its own.

---

## Verification Steps

1. **Workspace installs:** from the repo root, run `npm install`. Expect exit code 0 and a generated `package-lock.json` at the root (commit it — it is the lockfile for both workspaces).
2. **Root scripts are inert but valid:** from the repo root, run `npm run build`. Expect exit code 0 with no work done, because `--if-present` skips both empty workspaces.
3. **Ignore rules:** from the repo root, run `git check-ignore -v apps/api/.env apps/api/.env.example`. Expect a match line for `.env` and **no** line for `.env.example`.
4. **Regression:** run `git status --porcelain`. Expect only the files this story created, plus `package-lock.json`. Expect **no** `node_modules/` entry. Expect `.squad/secrets.yaml` to remain untracked and ignored.
5. **Structure:** run `git status --porcelain --untracked-files=all` and confirm nothing under `apps/api/` or `apps/web/` appears — both must still be empty.

---

## Done Criteria

- [ ] `apps/api/`, `apps/web/`, and `docs/` exist; `apps/api/` and `apps/web/` are empty.
- [ ] Root `package.json` declares `private: true`, `workspaces: ["apps/*"]`, `engines.node >= 24`, and the `dev:api` / `dev:web` / `build` / `test` / `lint` / `typecheck` scripts.
- [ ] `npm install` at the root exits 0 and produces a root `package-lock.json`.
- [ ] `.nvmrc` and `.node-version` both contain `24`.
- [ ] `.editorconfig` sets `end_of_line = lf`; `.prettierrc.json` and `.prettierignore` exist, and `.prettierignore` excludes `apps/api/prisma/migrations`.
- [ ] `.gitignore` lines 1–8 are unchanged and all new rules sit below `# End squad-kit block`.
- [ ] `git check-ignore` matches `apps/api/.env` and does **not** match `apps/api/.env.example`.
- [ ] `apps/api/.env.example` defines `NODE_ENV`, `PORT`, `DATABASE_URL` (pointing at `CustomerCRM`), `CORS_ORIGINS`, and `LOG_LEVEL`.
- [ ] `apps/web/.env.example` defines `VITE_API_BASE_URL`.
- [ ] `docs/adr/0001-stack-decisions.md` records the PostgreSQL, NestJS, and npm-workspaces decisions.
- [ ] `README.md` lists both workspaces, the requirements, and the run commands.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 02.**
