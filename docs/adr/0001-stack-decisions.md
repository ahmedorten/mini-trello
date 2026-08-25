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
