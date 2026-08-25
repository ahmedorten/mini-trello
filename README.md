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
