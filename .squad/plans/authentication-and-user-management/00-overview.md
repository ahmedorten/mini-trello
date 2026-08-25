# authentication-and-user-management — plan overview

Entry point for the **authentication-and-user-management** feature. Stories execute in order by their `NN` prefix.

Azure DevOps work item **2 — "Authentication & User Management"** is split into four sequential stories. All four share the same tracker id because they deliver one work item; each ends with a stop-and-report gate.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 05 | [05-story-identity-data-model-2.md](05-story-identity-data-model-2.md) | Identity data model: users, roles, permissions, departments, branches | 2 | 04 |
| 06 | [06-story-jwt-authentication-2.md](06-story-jwt-authentication-2.md) | JWT authentication: login, logout, refresh, and protected endpoints | 2 | 05 |
| 07 | [07-story-rbac-user-management-api-2.md](07-story-rbac-user-management-api-2.md) | RBAC enforcement and the user management API | 2 | 06 |
| 08 | [08-story-frontend-auth-user-management-2.md](08-story-frontend-auth-user-management-2.md) | Frontend: login, protected routes, and the user management screen | 2 | 07 |

## Dependency notes

**Strictly sequential.** Each story ends with a `STOP HERE` gate; do not start the next until the previous one's Done Criteria are met.

- **04 → 05.** The whole feature builds on [work item 1](../init-porject/00-overview.md): npm workspaces, the NestJS API with its global `ValidationPipe` and `AllExceptionsFilter`, Prisma against PostgreSQL `CustomerCRM`, and the Vue 3 shell.
- **05 → 06, 07, 08.** Story 05 is the **only** story in this feature that creates a migration. Every column Stories 06–08 read — `users.failed_login_attempts`, `users.locked_until`, `users.last_login_at`, `users.must_change_password`, and the whole `refresh_tokens` table — is created there. Discovering a missing column in 06 or 07 means revising Story 05, not adding a second migration.
- **06 → 07.** Story 07's `PermissionsGuard` reads `request.user.permissions`, which only exists because Story 06's `JwtAuthGuard` writes it. Story 07 also depends on `TokenService.revokeAllForUser` for deactivation and password resets.
- **07 → 08.** Story 08's route guard and its permission-aware navigation consume the exact permission keys Story 07 enforces, and its axios interceptor branches on Story 07's `403`-versus-`401` distinction. Building the frontend before 07 means reworking it.

### Shared contracts

Changing any of these requires updating every story that references it, in the same commit.

| Contract | Defined in | Consumed by |
|---|---|---|
| The ten permission keys (`users:read`, `users:write`, `users:deactivate`, `roles:read`, `roles:assign`, `departments:read`, `departments:write`, `branches:read`, `branches:write`, `reports:read`) | Story 05 task 4 (`prisma/seed.ts`) | Story 07 (`@RequirePermissions()` on every route); Story 08 (nav visibility, route `meta.permissions`) |
| The six role keys (`system-administrator`, `crm-manager`, `support-supervisor`, `support-agent`, `customer`, `reporting-user`) | Story 05 task 4 | Story 07 (escalation rule, last-administrator rule); Story 08 (role pickers) |
| Password digest format `scrypt$N$r$p$saltB64$hashB64` | Story 05 task 3 (`PasswordService`), duplicated in `prisma/seed.ts` | Story 06 (`AuthService.login`); Story 07 (create, reset) — **the seed's copy and the service must stay byte-compatible** |
| `AuthenticatedUser` shape on `request.user` | Story 06 task 3 | Story 07 (`PermissionsGuard`, `UsersService.findOne`) |
| `CurrentUserDto` field set | Story 06 task 6 | Story 08 (`AuthUser` mirrors it field-for-field) |
| `UserResponseDto` / `PaginatedUsersDto` field sets | Story 07 task 3 | Story 08 (`UserSummary`, `PaginatedUsers`) |
| Refresh cookie `crm_refresh`, `httpOnly`, `SameSite=Lax`, `Path=/api/auth` | Story 06 task 6 (`auth.cookie.ts`) | Story 08 (`withCredentials`, silent restore) |
| `401` = authenticate; `403` = insufficient permission | Story 06 (`JwtAuthGuard`) and Story 07 (`PermissionsGuard`) | Story 08's axios interceptor branches on exactly this |

### Product decisions

Resolved once, in each story's **Product rules (from story)** table. Summarised here so no later story re-litigates them.

- **Roles are seeded rows, not a Prisma enum.** A new role must not require a migration.
- **Users hold many roles**; permissions are granted to roles only, never directly to users.
- **scrypt from `node:crypto`**, not argon2 or bcrypt. Both alternatives need `node-gyp`, and this tree is developed on Windows with no guaranteed toolchain — the same class of environment constraint that made work item 1 choose npm workspaces over pnpm.
- **Access token in memory, refresh token in an httpOnly cookie.** No token of any kind touches `localStorage` or `sessionStorage`.
- **The guard reads roles and permissions from the database on every request**, rather than trusting JWT claims. Deactivation and role changes therefore take effect on the next request instead of after a token lifetime. The cost is one indexed query per request.
- **No Passport.** A hand-written guard over `JwtService.verifyAsync` replaces `@nestjs/passport` + `passport-jwt`.
- **Deny by default on both sides:** a global `APP_GUARD` on the API opened with `@Public()`, and a router guard on the SPA opened with `meta.public`.
- **Users are deactivated, never deleted.** Deletion cascades away role grants and sessions and would orphan any future ticket history.
- **The system cannot lock itself out.** The last active `system-administrator` cannot be deactivated or demoted, and only an administrator can grant or revoke that role.
- **One login error message** for wrong email, wrong password, inactive, and locked. The real reason goes to the server log, keyed by user id. The accepted cost is that a locked-out user is not told they are locked.

### Deliberate scope exclusions

Recorded so later stories do not treat them as oversights.

- **No self-service password change, forgot-password, or email verification.** All three need a mailer, which does not exist. Story 05 sets `mustChangePassword` on every administrator-created account and Story 08 surfaces it as a banner that tells the user to ask an administrator — deliberately not a dead-end "change password" link.
- **No MFA, no OAuth/SSO.**
- **No IP-based rate limiting or CAPTCHA.** Brute-force protection is per-**account** only: five failures lock for fifteen minutes (Story 06). A botnet spraying one password across many accounts is not stopped, and the lockout itself is a denial-of-service lever against a known address. Both are documented in Story 06's Edge Cases.
- **No audit log table.** Every mutation emits a structured log line carrying `actorId` and `userId` (Story 07), which is the substitute. A real audit trail is its own story.
- **No `refresh_tokens` cleanup job.** Nothing prunes revoked or expired rows. Harmless at this scale; an operations concern.
- **`/api/docs` and `/api/docs-json` remain unauthenticated.** `SwaggerModule.setup` mounts Express middleware rather than a Nest controller, so the global guard never runs on it. This continues [work item 1's recorded exclusion](../init-porject/00-overview.md) and **must be gated before the first deployment holding customer data.**
- **No `Customer` entity.** The `customer` role is seeded with zero permissions so the assignment API and the management screen can round-trip it. A customer portal is a later work item.
- **No department or branch management screens.** Story 07 ships the API; Story 08 consumes only `GET /api/departments`, for the user form's dropdown. The screens are a follow-up.
- **No end-to-end browser test.** Consistent with work item 1. Story 08's browser path is covered manually by its Verification Steps 6–18.

### Environment prerequisites

- Node.js **24 LTS** and npm 11+. Verified present when planning: `node v24.14.0`, `npm 11.9.0`.
- **PostgreSQL must be running** for Stories 05, 06, and 07 — every e2e spec in them reads or writes real tables.
- **`JWT_ACCESS_SECRET` (32+ characters) must be in `apps/api/.env` from Story 06 onward.** The API refuses to boot without it, by design. That failed boot is the first thing to check after Story 06 lands.
- The seeded administrator's password must be known from Story 05 onward. If Story 05's seed generated one, it was printed exactly once — set `BOOTSTRAP_ADMIN_PASSWORD` before seeding, or be prepared to reset the database.
- **Story 08 needs both dev servers running.** The httpOnly refresh cookie only works through the Vite proxy, which makes the SPA and the API a single origin. `apps/web/.env` must keep `VITE_API_BASE_URL` **empty** in development.
- New dependencies, all pure JavaScript with **no** native build step: `@nestjs/jwt`, `cookie-parser`, and `@types/cookie-parser` (Story 06). Stories 05, 07, and 08 add none.
