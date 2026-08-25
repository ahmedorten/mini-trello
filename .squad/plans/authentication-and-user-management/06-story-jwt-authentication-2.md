# Story 06 — JWT authentication: login, logout, refresh, and protected endpoints (Story: 2)

## Prerequisites

- [Story 05 completed](05-story-identity-data-model-2.md): the `identity_and_rbac` migration is applied, the seed produces the six roles and a bootstrap administrator, `apps/api/src/auth/password.service.ts` exports `PasswordService`, and `apps/api/src/auth/auth.module.ts` exists and is imported by `AppModule`.
- [Story 02 completed](../init-porject/02-story-backend-api-bootstrap-1.md): global `api` prefix, `ValidationPipe` with `whitelist: true` **and `forbidNonWhitelisted: true`**, `AllExceptionsFilter`, Swagger at `/api/docs`, and `nestjs-pino` request logging.
- **PostgreSQL must be running.** Every auth path reads or writes `users` and `refresh_tokens`.
- A known bootstrap password. If Story 05's seed generated one, it was printed once — re-seed into a fresh database or set `BOOTSTRAP_ADMIN_PASSWORD` and reset if it was lost.

---

## Story Goal

Turn the identity tables into a working authentication system, and make **every** endpoint protected by default.

User-visible outcomes:

1. `POST /api/auth/login` with a correct email and password returns a short-lived access token and sets an **httpOnly** refresh cookie.
2. `POST /api/auth/refresh` exchanges that cookie for a new access token and a **rotated** refresh cookie, with no credentials re-sent.
3. `POST /api/auth/logout` revokes the session server-side and clears the cookie.
4. `GET /api/auth/me` returns the caller's identity, roles, and permissions.
5. Any request to a protected endpoint without a valid access token returns **`401`** in the standard error envelope — never a stack trace, never a `500`.
6. Repeated failed logins lock the account for a cooldown window.
7. `/api/docs` shows an **Authorize** button and every protected operation carries the lock icon.

**Not in scope:** permission checks on individual endpoints and the user-management API — Story 07. Any frontend change — Story 08. Password self-service (change/forgot/reset by the user), MFA, OAuth/SSO, and IP-based rate limiting: explicitly deferred, see the overview's scope exclusions.

---

## Product rules (from story)

The intake requires "JWT authentication" and that the "Authentication token is handled securely" but does not say where the token lives. These decisions are **fixed** and Story 08 implements the client half of them.

| Topic | **Decision** | Why |
|---|---|---|
| Token pair | **Short-lived access JWT (15 min) + long-lived opaque refresh token (7 days)** | A single long-lived JWT cannot be revoked. An opaque refresh token can, because it is a database row. |
| Access token transport | `Authorization: Bearer <token>`, held in **browser memory only** | Never `localStorage` or `sessionStorage`: both are readable by any injected script. |
| Refresh token transport | **httpOnly, SameSite=Lax cookie**, scoped to path `/api/auth` | JavaScript cannot read it, so an XSS payload cannot exfiltrate a long-lived credential. The path scope keeps it off every other request. |
| Refresh token at rest | **SHA-256 digest**, never the raw value | A leaked database dump yields no usable session. SHA-256 rather than scrypt because the token is already 256 bits of entropy — stretching adds cost, not security. |
| Rotation | Every refresh **revokes** the presented token and issues a new one | Limits the useful life of a stolen cookie to one use. |
| Reuse detection | Presenting an already-revoked token revokes **every** session for that user | A replayed token means either the client or the cookie was cloned. Fail closed. |
| Authorization source of truth | The guard loads the user, roles, and permissions **from the database on every request** | A deactivated user or a revoked role takes effect immediately. Claims baked into the JWT would stay valid for up to 15 minutes. The cost is one indexed query per request; caching is a later optimisation, not this story's problem. |
| Passport | **Not used.** A hand-written `JwtAuthGuard` over `JwtService.verifyAsync` | `@nestjs/passport` + `passport-jwt` adds two dependencies and a strategy indirection for roughly thirty lines of guard. |
| Default posture | **Deny by default** — a global `APP_GUARD`, opened per route with `@Public()` | The acceptance criterion is "Protected APIs reject unauthorized requests". Opt-in protection means the next new controller is accidentally public. |

---

## Context — Read These Files First

1. `apps/api/src/main.ts` — all 55 lines. You edit three regions: the global prefix and pipes (lines 22–33), the `DocumentBuilder` chain (lines 39–44), and you insert `cookieParser()` before them. Note that `AllExceptionsFilter` is constructed manually at line 33 — that is why the e2e test in the Test Plan must repeat the same wiring.
2. `apps/api/src/app.module.ts` — all 50 lines. The `ConfigModule.forRoot` block (lines 12–17), the `LoggerModule.forRoot` block with its `redact.paths` array (lines 28–36), and the `imports` tail (lines 46–47) where `AuthModule` was added in Story 05.
3. `apps/api/src/config/env.validation.ts` — lines 29–52 (`EnvironmentVariables`) and 54–73 (`validateEnv`). Note the existing `@Matches` usage on `DATABASE_URL` (lines 48–51) — task 2 follows that exact style for the TTL string.
4. `apps/api/src/common/filters/all-exceptions.filter.ts` — lines 11–18 for the `ErrorResponseBody` interface and lines 38–47 for how an `HttpException` body is unwrapped. Your `UnauthorizedException('Invalid email or password.')` surfaces as `message: "Invalid email or password."` through this path. **Nothing in the filter needs to change.**
5. `apps/api/src/health/health.controller.ts` — all 32 lines. Two things: the `@Res({ passthrough: true })` pattern at line 27 that the auth controller reuses to set cookies, and the fact that this controller **must** gain `@Public()` in task 8 or the existing health e2e test breaks.
6. `apps/api/src/auth/password.service.ts` (Story 05) — read `verify`'s signature and its "returns false, never throws" contract. `AuthService` depends on that.
7. `apps/api/prisma/schema.prisma` — the `User` model's `failedLoginAttempts`, `lockedUntil`, `lastLoginAt`, `isActive` columns and the whole `RefreshToken` model, all added in Story 05. These exist already; **this story adds no migration**.
8. `apps/api/test/health.e2e-spec.ts` — all 110 lines, especially the `beforeAll` wiring at lines 12–46. The global guard you add in task 8 applies to this test too; understand why before you run it.
9. Grep for `@nestjs/jwt` in `apps/api/package.json` to confirm it is **absent** before task 1 installs it.

---

## Backend Tasks

### 1 — Install dependencies

From the **repo root**, so they hoist into the root `node_modules`:

```bash
npm install --workspace @crm/api @nestjs/jwt cookie-parser
npm install --workspace @crm/api --save-dev @types/cookie-parser
```

- `@nestjs/jwt` — resolve `^11.x` to match NestJS 11. It wraps `jsonwebtoken`; **no native build**, consistent with Story 05's reasoning.
- `cookie-parser` — needed to read the refresh cookie. Express does not parse cookies on its own.

Then `npm install` at the root once more to refresh the lockfile. Confirm **no** `apps/api/node_modules` directory appears.

---

### 2 — Environment variables

**File: `apps/api/src/config/env.validation.ts`**

Add three fields to `EnvironmentVariables`, after `DATABASE_URL` (line 51):

```ts
  /** HS256 signing key for access tokens. Must be at least 32 characters. */
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  /** Access token lifetime, as a jsonwebtoken duration string. */
  @IsString()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_ACCESS_TTL must look like 15m, 900s, 1h or 1d',
  })
  JWT_ACCESS_TTL: string = '15m';

  /** Refresh token lifetime in whole days. */
  @IsInt()
  @Min(1)
  @Max(90)
  JWT_REFRESH_TTL_DAYS: number = 7;
```

Add `MinLength` to the `class-validator` import list at lines 2–12. `IsInt`, `Min`, `Max`, `Matches`, and `IsString` are already imported.

**`JWT_ACCESS_SECRET` has no default on purpose.** `validateEnv` runs with `skipMissingProperties: false` (line 61), so a missing secret fails the app at boot with `Invalid environment configuration: JWT_ACCESS_SECRET must be at least 32 characters`. A defaulted signing key is a signing key that ships to production.

There is **no** `AUTH_COOKIE_SECURE` variable. The `secure` cookie flag is derived from `NODE_ENV === 'production'` in task 6 — one fewer boolean to mis-coerce, since `enableImplicitConversion` handles numbers and enums reliably here but boolean-from-string is a known foot-gun.

**File: `apps/api/.env.example`**

Append, in the existing comment style:

```dotenv
# --- Authentication ---
# HS256 signing key for access tokens. At least 32 characters, unique per
# environment. Generate one with:  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_ACCESS_SECRET=dev_only_change_me_0123456789abcdefghijklmnop
# Access token lifetime: 15m, 900s, 1h, 1d …
JWT_ACCESS_TTL=15m
# Refresh token (httpOnly cookie) lifetime, in whole days.
JWT_REFRESH_TTL_DAYS=7
```

Copy the same three lines into `apps/api/.env`. **The API will not boot without `JWT_ACCESS_SECRET`** — that is the intended behaviour, and it is the first thing to check when the app fails to start after this story.

---

### 3 — Authenticated-user shape and decorators

**Create file: `apps/api/src/auth/types/authenticated-user.ts`**

```ts
/**
 * What JwtAuthGuard attaches to request.user. Built from the database on every
 * request, so it is always current — never read identity from the JWT claims.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  departmentId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}
```

**Create file: `apps/api/src/auth/decorators/public.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Opts a route (or a whole controller) out of the global JwtAuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Create file: `apps/api/src/auth/decorators/current-user.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Injects the user JwtAuthGuard resolved. Only valid on routes the guard ran
 * on — on a @Public() route it is undefined, hence the non-null assertion is
 * deliberately absent from the return type.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (!request.user) {
      throw new Error('@CurrentUser() used on a route without JwtAuthGuard');
    }

    return request.user;
  },
);
```

Throwing a plain `Error` here is correct: it signals a **programming** mistake, is caught by `AllExceptionsFilter`, and returns `500`. A `401` would hide the bug.

---

### 4 — Token service

**Create file: `apps/api/src/auth/token.service.ts`**

Owns every secret-adjacent operation: signing access tokens, minting and hashing refresh tokens, rotation, and revocation.

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {}

  /** SHA-256 of the raw token. The stored form; never store the raw value. */
  static digest(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async issue(userId: string, email: string, userAgent?: string): Promise<IssuedTokens> {
    const ttl = this.configService.get('JWT_ACCESS_TTL', { infer: true });

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, jti: randomUUID() } satisfies AccessTokenClaims,
      { expiresIn: ttl },
    );

    const days = this.configService.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: TokenService.digest(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });

    return {
      accessToken,
      expiresInSeconds: TokenService.ttlToSeconds(ttl),
      refreshToken,
      refreshExpiresAt,
    };
  }

  /**
   * Consumes a refresh token. Returns the owning user id, or null when the
   * token is unknown, expired, or belongs to an inactive user.
   *
   * Presenting an ALREADY-REVOKED token is treated as theft: every session for
   * that user is revoked and null is returned.
   */
  async consume(rawToken: string): Promise<string | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: TokenService.digest(rawToken) },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!record) {
      return null;
    }

    if (record.revokedAt) {
      this.logger.warn(
        { userId: record.userId },
        'Revoked refresh token replayed; revoking all sessions for this user',
      );
      await this.revokeAllForUser(record.userId);
      return null;
    }

    if (record.expiresAt.getTime() <= Date.now() || !record.user.isActive) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return record.userId;
  }

  /** Revokes one token by its raw value. Silent when it is unknown. */
  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: TokenService.digest(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);

    if (!match) {
      // Unreachable: validateEnv enforces the format at boot.
      return 900;
    }

    const value = Number(match[1]);
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 1;

    return value * multiplier;
  }
}
```

**Details that matter:**

- `randomBytes(32).toString('base64url')` — 256 bits, URL- and cookie-safe with no padding. **Do not** use `randomUUID()` for the refresh token: 122 bits of entropy in a guessable format.
- `consume` **revokes before returning**, inside the same call. A caller that then fails to mint new tokens leaves the user logged out rather than holding a reusable token.
- `revoke` uses `updateMany` with a `revokedAt: null` filter, so it is idempotent and never throws on an unknown token — a logout must not fail because the cookie was stale.
- `userAgent?.slice(0, 255)` — the column is unbounded `TEXT`, but a hostile client can send megabytes.
- `ttlToSeconds` is `static` and pure so the Test Plan can exercise it without the DI container.

---

### 5 — Auth service

**Create file: `apps/api/src/auth/auth.service.ts`**

```ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { IssuedTokens, TokenService } from './token.service';
import type { AuthenticatedUser } from './types/authenticated-user';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * A real scrypt digest of a random string, hashed once at module load. Verified
 * against when no user matches, so a wrong email and a wrong password cost the
 * same wall-clock time and cannot be told apart by an attacker.
 */
const DUMMY_HASH_PROMISE = new PasswordService().hash(
  'timing-equaliser-not-a-real-password',
);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async login(email: string, password: string, userAgent?: string): Promise<IssuedTokens> {
    const normalized = AuthService.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, passwordHash: true, isActive: true, lockedUntil: true },
    });

    if (!user) {
      await this.passwordService.verify(password, await DUMMY_HASH_PROMISE);
      this.logger.warn({ email: normalized }, 'Login failed: no such account');
      throw AuthService.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      this.logger.warn({ userId: user.id }, 'Login rejected: account locked');
      throw AuthService.invalidCredentials();
    }

    if (!user.isActive) {
      await this.passwordService.verify(password, user.passwordHash);
      this.logger.warn({ userId: user.id }, 'Login rejected: account inactive');
      throw AuthService.invalidCredentials();
    }

    const matches = await this.passwordService.verify(password, user.passwordHash);

    if (!matches) {
      await this.registerFailure(user.id);
      this.logger.warn({ userId: user.id }, 'Login failed: wrong password');
      throw AuthService.invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    this.logger.log({ userId: user.id }, 'Login succeeded');

    return this.tokenService.issue(user.id, user.email, userAgent);
  }

  async refresh(rawToken: string, userAgent?: string): Promise<IssuedTokens> {
    const userId = await this.tokenService.consume(rawToken);

    if (!userId) {
      throw new UnauthorizedException('Session expired. Sign in again.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });

    return this.tokenService.issue(user.id, user.email, userAgent);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) {
      await this.tokenService.revoke(rawToken);
    }
  }

  /** Loads the full authorization context. Called by JwtAuthGuard per request. */
  async loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        mustChangePassword: true,
        departmentId: true,
        branchId: true,
        roles: {
          select: {
            role: {
              select: {
                key: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const permissions = new Set<string>();

    for (const assignment of user.roles) {
      for (const grant of assignment.role.permissions) {
        permissions.add(grant.permission.key);
      }
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      mustChangePassword: user.mustChangePassword,
      departmentId: user.departmentId,
      branchId: user.branchId,
      roles: user.roles.map((assignment) => assignment.role.key).sort(),
      permissions: [...permissions].sort(),
    };
  }

  private async registerFailure(userId: string): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
          failedLoginAttempts: 0,
        },
      });
      this.logger.warn({ userId }, `Account locked for ${LOCKOUT_MINUTES} minutes`);
    }
  }

  private static invalidCredentials(): UnauthorizedException {
    // One message for every failure mode — wrong email, wrong password,
    // inactive, locked. Distinguishing them turns login into an account
    // enumeration oracle. The server log above records the real reason.
    return new UnauthorizedException('Invalid email or password.');
  }
}
```

**Details that matter:**

- **One error message for every failure.** Wrong email, wrong password, inactive, and locked all return `Invalid email or password.` The distinction lives in the log line, keyed by `userId`. This is a deliberate usability trade — see Edge Cases.
- The dummy-hash verify on the no-such-user path equalises response time. Without it, "user not found" returns in ~1 ms and "wrong password" in ~100 ms, which is a reliable enumeration signal.
- `registerFailure` resets `failedLoginAttempts` to 0 **when it locks**, so the counter measures attempts *since the last lock* rather than growing forever.
- `loadAuthenticatedUser` returns `null` for an inactive user. Deactivation therefore takes effect on the **next request**, not on the next token refresh.
- Permissions are de-duplicated through a `Set` and both arrays are **sorted**, so the response is stable and Story 08's tests can compare them directly.
- **Never** log `password`, and never put the email in a log line keyed alongside a password field.

---

### 6 — DTOs

**Create file: `apps/api/src/auth/dto/login.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@crm.local', maxLength: 254 })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'ChangeMe_Dev_Only_1', minLength: 8, maxLength: 256 })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}
```

`MaxLength(254)` matches the RFC 5321 address limit. `MaxLength(256)` on the password caps scrypt's input so a 10 MB body cannot be used as a CPU-exhaustion lever.

The global pipe has **`forbidNonWhitelisted: true`** (`main.ts` line 27), so a body carrying any extra property returns `400` listing it. That is correct and must not be relaxed.

**Create file: `apps/api/src/auth/dto/login-response.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ description: 'Bearer token. Hold in memory only — never in localStorage.' })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds.' })
  expiresInSeconds!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;
}
```

**The refresh token is deliberately absent from this DTO.** It travels only in the `Set-Cookie` header. Putting it in the body would let JavaScript read it and defeat the whole design.

**Create file: `apps/api/src/auth/dto/current-user.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@crm.local' })
  email!: string;

  @ApiProperty({ example: 'System Administrator' })
  fullName!: string;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  departmentId!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  branchId!: string | null;

  @ApiProperty({ type: [String], example: ['system-administrator'] })
  roles!: string[];

  @ApiProperty({ type: [String], example: ['users:read', 'users:write'] })
  permissions!: string[];
}
```

`CurrentUserDto` is field-for-field identical to `AuthenticatedUser` (task 3). **It is the contract Story 08's `AuthUser` interface mirrors** — changing either requires changing both in the same commit.

**Create file: `apps/api/src/auth/auth.cookie.ts`**

One place that knows the cookie's name and flags, so the controller cannot set and clear it inconsistently.

```ts
import type { CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'crm_refresh';

/**
 * `path` is scoped to the auth routes so the long-lived credential is not
 * attached to every API request. `sameSite: 'lax'` is correct for the dev
 * setup, where the Vite proxy makes the browser see one origin — a deployment
 * that serves the SPA from a different site must switch to 'none' with
 * `secure: true`, or the browser will drop the cookie on refresh.
 */
export function refreshCookieOptions(expiresAt: Date, isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/api/auth',
    expires: expiresAt,
  };
}

export function clearedRefreshCookieOptions(isProduction: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/api/auth' };
}
```

`res.clearCookie` only matches a cookie when `path` and the other attributes are identical to how it was set — hence the second helper rather than a bare `clearCookie(name)`.

---

### 7 — JWT guard and auth controller

**Create file: `apps/api/src/auth/guards/jwt-auth.guard.ts`**

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenClaims } from '../token.service';
import type { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = JwtAuthGuard.extractBearer(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    let claims: AccessTokenClaims;

    try {
      claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token);
    } catch {
      // Expired, wrong signature, malformed — all one message. The client
      // reaction (refresh, then redirect to login) is identical.
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const user = await this.authService.loadAuthenticatedUser(claims.sub);

    if (!user) {
      this.logger.warn({ userId: claims.sub }, 'Valid token for a missing or inactive user');
      throw new UnauthorizedException('Account is no longer active.');
    }

    request.user = user;

    return true;
  }

  private static extractBearer(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    const [scheme, value] = header.split(' ');

    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
```

`getAllAndOverride` with `[handler, class]` in that order lets a `@Public()` method open a single route on an otherwise protected controller. Reversing the array inverts the precedence.

**Create file: `apps/api/src/auth/auth.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { NodeEnv, EnvironmentVariables } from '../config/env.validation';
import { clearedRefreshCookieOptions, REFRESH_COOKIE_NAME, refreshCookieOptions } from './auth.cookie';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CurrentUserDto } from './dto/current-user.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import type { IssuedTokens } from './token.service';
import type { AuthenticatedUser } from './types/authenticated-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Returns an access token in the body and a rotating refresh token in an httpOnly cookie.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials, or the account is locked.' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.login(
      dto.email,
      dto.password,
      request.headers['user-agent'],
    );

    return this.respondWithTokens(tokens, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({
    summary: 'Exchange the refresh cookie for a new access token',
    description: 'Rotates the refresh token. Replaying a consumed token revokes every session.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, expired, or already-used refresh token.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const raw = AuthController.readRefreshCookie(request);

    if (!raw) {
      response.clearCookie(REFRESH_COOKIE_NAME, clearedRefreshCookieOptions(this.isProduction));
      throw new UnauthorizedException('No session cookie.');
    }

    const tokens = await this.authService.refresh(raw, request.headers['user-agent']);

    return this.respondWithTokens(tokens, response);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out',
    description: 'Revokes the presented refresh token and clears the cookie. Always succeeds.',
  })
  @ApiNoContentResponse({ description: 'Session cleared.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(AuthController.readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE_NAME, clearedRefreshCookieOptions(this.isProduction));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user, with roles and permissions' })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  me(@CurrentUser() user: AuthenticatedUser): CurrentUserDto {
    return user;
  }

  private get isProduction(): boolean {
    return this.configService.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
  }

  private respondWithTokens(tokens: IssuedTokens, response: Response): LoginResponseDto {
    response.cookie(
      REFRESH_COOKIE_NAME,
      tokens.refreshToken,
      refreshCookieOptions(tokens.refreshExpiresAt, this.isProduction),
    );

    return {
      accessToken: tokens.accessToken,
      expiresInSeconds: tokens.expiresInSeconds,
      tokenType: 'Bearer',
    };
  }

  private static readRefreshCookie(request: Request): string | undefined {
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    const value = cookies?.[REFRESH_COOKIE_NAME];

    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
```

**Details that matter:**

- `login`, `refresh`, and `logout` are all `@Public()`. They must be reachable *without* an access token — that is the entire point. Authorization for them comes from the credentials or the cookie, not the guard.
- `@HttpCode(HttpStatus.OK)` on `login` and `refresh`: `@Post()` defaults to `201`, which is wrong for a non-creating operation and confuses HTTP clients.
- `logout` is `204` and **always succeeds**, even with no cookie or an unknown one. A logout that can fail leaves users stuck.
- `refresh` clears the cookie before throwing when none was sent, so a stale browser cookie cannot cause a redirect loop in Story 08.
- `me` returns the `AuthenticatedUser` directly. It structurally satisfies `CurrentUserDto`; do **not** re-map it field by field, or the two shapes will drift.

---

### 8 — Wire it up

**File: `apps/api/src/auth/auth.module.ts`** (created in Story 05)

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EnvironmentVariables } from '../config/env.validation';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
        secret: configService.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
```

- **`verifyOptions: { algorithms: ['HS256'] }` is mandatory.** Without an allow-list, a token declaring `"alg": "none"` is a known bypass class. Pin it.
- `APP_GUARD` — registering the guard as a provider here (rather than `app.useGlobalGuards()` in `main.ts`) is what lets it inject `Reflector`, `JwtService`, and `AuthService`. It applies application-wide even though it is declared in this module.

**File: `apps/api/src/health/health.controller.ts`**

Add `@Public()` **on the class**, next to `@ApiTags('health')` and `@Controller('health')` (lines 12–13):

```ts
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
```

**This is not optional.** Without it, the global guard makes `/api/health` return `401`, breaking `apps/api/test/health.e2e-spec.ts` (lines 52–68) and Story 04's System status page. Liveness probes cannot authenticate.

**File: `apps/api/src/main.ts`**

Three edits:

1. Insert cookie parsing **before** the global prefix (line 22):

```ts
import cookieParser from 'cookie-parser';
// …
app.use(cookieParser());
```

If `esModuleInterop` is off in `apps/api/tsconfig.json`, use `import * as cookieParser from 'cookie-parser';` instead — read the file and match whichever form the existing `import * as request from 'supertest'` style in `test/health.e2e-spec.ts` line 5 implies for this compiler configuration.

2. Add bearer auth to the Swagger document, in the `DocumentBuilder` chain (lines 39–44), after `.addTag('health', …)`:

```ts
    .addTag('auth', 'Authentication and session management')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'bearer',
    )
    .addCookieAuth('crm_refresh')
```

`persistAuthorization: true` is already set at line 47, so the token survives a Swagger UI page reload.

3. Leave `enableCors` (lines 35–37) as it is — `credentials: true` is already there, which the refresh cookie needs.

**File: `apps/api/src/app.module.ts`**

Add one entry to the `redact.paths` array (lines 29–34):

```ts
            'req.body.password',
```

pino-http does not serialize the request body by default, so this is defensive rather than load-bearing — it means a future custom serializer cannot leak a password into the logs. Add a one-line comment saying exactly that, so the next reader does not assume bodies are being logged today.

---

## Edge Cases & Failure Modes

- **No `JWT_ACCESS_SECRET`.** The app refuses to boot with `Invalid environment configuration: JWT_ACCESS_SECRET must be at least 32 characters`, thrown by `validateEnv` (`env.validation.ts` lines 65–70). Deliberate: a defaulted signing key is worse than a failed boot.
- **Secret rotated while sessions are live.** Every existing access token fails verification and returns `401`; refresh cookies still work because they are database rows, not signed. Clients recover on their next refresh. Rotating the secret is therefore a soft, not a hard, logout.
- **Expired access token.** `verifyAsync` throws `TokenExpiredError`; the guard converts it to `401 Invalid or expired access token.` Story 08's interceptor treats that as "try refresh once".
- **`alg: none` or an RS256-signed token.** Rejected by the `algorithms: ['HS256']` allow-list in `auth.module.ts`. Covered by Test Plan item 6.
- **Account enumeration.** Wrong email, wrong password, inactive, and locked all return the same `401` body and comparable timing (the dummy-hash verify in `AuthService.login`). **Accepted cost:** a locked-out user sees "Invalid email or password" and cannot tell they are locked. The server log carries the real reason keyed by `userId`; an administrator diagnoses it there.
- **Brute force.** Five consecutive failures lock the account for 15 minutes. Per-**account**, not per-IP: a botnet spraying one password across many accounts is not stopped by this, and IP throttling is explicitly out of scope. `MAX_FAILED_ATTEMPTS` and `LOCKOUT_MINUTES` are module constants in `auth.service.ts`, not configuration — promote them if operations asks.
- **Lockout as a denial-of-service.** An attacker who knows an address can keep that account locked indefinitely. Mitigating this needs IP throttling or a CAPTCHA; documented, not solved here.
- **Replayed refresh token.** `TokenService.consume` finds a `revokedAt` row, revokes **every** session for that user, and returns `null` → `401`. The legitimate user is logged out too. That is the correct trade when a token has demonstrably been duplicated.
- **Two concurrent refresh calls from the same tab** (Story 08's interceptor firing twice). The first consumes the row; the second sees `revokedAt` set and triggers the reuse path, logging the user out. **Story 08 must serialise refreshes behind a single shared promise** — this is the reason that requirement exists.
- **User deactivated mid-session.** `loadAuthenticatedUser` returns `null` and the next request gets `401 Account is no longer active.` No wait for token expiry. The refresh path also fails, because `consume` checks `user.isActive`.
- **Role changed mid-session.** Picked up on the very next request, since the guard reads roles and permissions from the database rather than from the JWT.
- **Cookie dropped by the browser on a cross-site deployment.** `sameSite: 'lax'` works in development because the Vite proxy makes the SPA and the API one origin. Serving the SPA from a different site requires `sameSite: 'none'` plus `secure: true` plus HTTPS — change `refreshCookieOptions` in `auth.cookie.ts` when that deployment exists. Symptom: login succeeds, then every refresh returns `401 No session cookie.`
- **`NODE_ENV=production` behind plain HTTP.** `secure: true` makes the browser refuse to store the cookie and refresh never works. Terminate TLS, or do not claim production.
- **`/api/docs` and `/api/docs-json` stay unauthenticated.** `SwaggerModule.setup` mounts Express middleware, not a Nest controller, so the global guard never runs on it. This continues the init-porject overview's recorded exclusion, and it must be gated before the first deployment holding customer data.
- **Unmatched route with no token,** e.g. `GET /api/nope`. Express finds no handler, so no guard executes and the response is `404`, not `401` — `health.e2e-spec.ts` lines 74–85 already assert this and must keep passing.
- **`@CurrentUser()` on a `@Public()` route.** Throws a plain `Error` → `500`. A programming error, surfaced loudly on purpose.
- **`refresh_tokens` grows without bound.** Nothing prunes revoked or expired rows. At this scale it does not matter; a cleanup job belongs to an operations story. Note it in a comment above the `RefreshToken` model rather than solving it here.

---

## Test Plan

1. **Unit — `apps/api/src/auth/token.service.spec.ts`** (new). Mock `PrismaService`, `JwtService`, and `ConfigService` with the `useValue` pattern from `apps/api/src/health/health.service.spec.ts` lines 13–29.
   - `TokenService.digest` is deterministic, 64 hex characters, and differs for differing input.
   - `TokenService.ttlToSeconds` maps `'900s'`→900, `'15m'`→900, `'1h'`→3600, `'1d'`→86400, and an unparsable string→900.
   - `issue` calls `jwtService.signAsync` with `expiresIn` from config, writes a `refreshToken` row whose `tokenHash` equals `digest(returned raw token)`, and **never** stores the raw token.
   - `issue` truncates a 10 000-character user agent to 255 characters.
   - `consume` returns the user id and marks the row revoked for a valid token.
   - `consume` returns `null` and calls `updateMany` over **all** the user's tokens when the row already has `revokedAt` set (reuse detection).
   - `consume` returns `null` for an unknown digest, for an expired row, and for a row whose user is `isActive: false`.
   - `revoke` filters on `revokedAt: null` and resolves without throwing for an unknown token.
2. **Unit — `apps/api/src/auth/auth.service.spec.ts`** (new). Mock `PrismaService`, `PasswordService`, and `TokenService`.
   - `AuthService.normalizeEmail` trims and lower-cases; `'  Admin@CRM.Local '` → `'admin@crm.local'`.
   - `login` looks the user up by the **normalized** email.
   - `login` throws `UnauthorizedException` with the message `Invalid email or password.` for: unknown email, wrong password, `isActive: false`, and `lockedUntil` in the future — assert the **same** message in all four.
   - `login` still calls `passwordService.verify` on the unknown-email path (the timing equaliser).
   - `login` on success resets `failedLoginAttempts` to 0, clears `lockedUntil`, sets `lastLoginAt`, and calls `tokenService.issue`.
   - `login` on the 5th consecutive failure sets `lockedUntil` roughly 15 minutes ahead and resets the counter.
   - `login` succeeds when `lockedUntil` is in the **past**.
   - `refresh` throws `UnauthorizedException` when `consume` returns `null`, and issues a new pair when it returns a user id.
   - `logout` with `undefined` resolves and does **not** call `revoke`.
   - `loadAuthenticatedUser` flattens roles → permissions, **de-duplicates** a permission granted by two roles, and returns both arrays sorted.
   - `loadAuthenticatedUser` returns `null` for a missing user and for one with `isActive: false`.
3. **Unit — `apps/api/src/auth/guards/jwt-auth.guard.spec.ts`** (new). Mock `Reflector`, `JwtService`, and `AuthService`; build a fake `ExecutionContext` exposing `switchToHttp().getRequest()`.
   - Returns `true` immediately, with no token, when `reflector.getAllAndOverride` yields `true`.
   - Throws `Missing bearer token.` for no header, for `'Basic abc'`, and for a bare `'Bearer'` with no value.
   - Accepts `'bearer <token>'` in lower case (scheme comparison is case-insensitive).
   - Throws `Invalid or expired access token.` when `verifyAsync` rejects.
   - Throws `Account is no longer active.` when `loadAuthenticatedUser` returns `null`.
   - On success, assigns the resolved user to `request.user` and returns `true`.
4. **E2E — `apps/api/test/auth.e2e-spec.ts`** (new). Copy the `beforeAll` wiring from `apps/api/test/health.e2e-spec.ts` lines 12–46 **and add `app.use(cookieParser())`** — without it every cookie test fails for the wrong reason. Requires a seeded database and `BOOTSTRAP_ADMIN_PASSWORD` set.
   - `POST /api/auth/login` with the seeded admin credentials returns `200`, an `accessToken`, `expiresInSeconds`, `tokenType: 'Bearer'`, and a `set-cookie` header containing `crm_refresh`, `HttpOnly`, `SameSite=Lax`, and `Path=/api/auth`.
   - The login response body contains **no** `refreshToken` property.
   - Login with a wrong password returns `401` and the body `message` is exactly `Invalid email or password.`
   - Login with an unknown email returns `401` with the **identical** message.
   - Login with `{ email, password, extra: 1 }` returns `400` naming `extra` (proves `forbidNonWhitelisted`).
   - Login with `email: 'not-an-email'` returns `400`.
   - `GET /api/auth/me` with the access token returns `200`, `email` equal to the lower-cased admin address, `roles` containing `system-administrator`, and `permissions` containing all ten seeded keys.
   - `GET /api/auth/me` with no header returns `401` in the `AllExceptionsFilter` envelope — assert `statusCode`, `message`, `error`, `path`, and `timestamp` are all present.
   - `GET /api/auth/me` with `Authorization: Bearer garbage` returns `401`.
   - `POST /api/auth/refresh` replaying the login cookie returns `200`, a **different** access token, and a **different** `crm_refresh` cookie value.
   - `POST /api/auth/refresh` with the **now-consumed** first cookie returns `401`, and a subsequent refresh with the second cookie **also** returns `401` (reuse detection revoked everything).
   - `POST /api/auth/refresh` with no cookie returns `401` and still sends a cookie-clearing `set-cookie`.
   - `POST /api/auth/logout` returns `204` with a clearing `set-cookie`; a refresh with that cookie afterwards returns `401`.
   - `POST /api/auth/logout` with no cookie at all returns `204`.
5. **E2E — same file.** Six consecutive wrong-password logins: the sixth returns `401`, and a login with the **correct** password immediately after also returns `401` (locked). Reset with `prisma.user.update({ data: { lockedUntil: null, failedLoginAttempts: 0 } })` in an `afterAll` so the spec is re-runnable.
6. **E2E — same file.** Forge a token signed `HS256` with the **wrong** secret, and one with `alg: 'none'` (hand-assemble `base64url(header).base64url(payload).`). Both return `401`. This is the algorithm-confusion regression test.
7. **E2E — same file.** `GET /api/docs-json` returns `200`; `components.securitySchemes.bearer` exists, `paths['/api/auth/login']` exists, and `paths['/api/auth/me']` carries a `security` entry while `/api/auth/login` does not.
8. **E2E — `apps/api/test/health.e2e-spec.ts`** (verify, do not rewrite). All five existing tests must still pass **unchanged** after the global guard lands. If `GET /api/health` returns `401`, task 8's `@Public()` on `HealthController` is missing. Add one test: `GET /api/health` with a deliberately invalid `Authorization` header still returns `200` — a public route must ignore a bad token rather than reject it.

---

## Verification Steps

1. **Dependencies install:** from the repo root, run `npm install`. Expect exit code 0, `@nestjs/jwt` and `cookie-parser` in `apps/api/package.json` dependencies, `@types/cookie-parser` in devDependencies, and **no** `apps/api/node_modules`.
2. **Boot fails without a secret:** temporarily remove `JWT_ACCESS_SECRET` from `apps/api/.env` and run `npm run dev:api`. Expect the process to exit with `Invalid environment configuration: JWT_ACCESS_SECRET must be at least 32 characters`. Restore it.
3. **Backend type-checks:** from `apps/api`, run `npm run typecheck`. Expect exit code 0.
4. **Backend lints:** from `apps/api`, run `npm run lint`. Expect exit code 0.
5. **Backend unit tests:** from `apps/api`, run `npm test`. Expect all specs green, including the three new ones.
6. **Backend e2e tests:** from `apps/api`, run `npm run test:e2e`. Expect `auth.e2e-spec.ts`, `health.e2e-spec.ts`, and `seed.e2e-spec.ts` all green.
7. **Login by hand:** with `npm run dev:api` running,

   ```bash
   curl -i -X POST http://localhost:3000/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@crm.local","password":"<your BOOTSTRAP_ADMIN_PASSWORD>"}'
   ```

   Expect `200`, an `accessToken` in the body, and a `Set-Cookie: crm_refresh=…; Path=/api/auth; HttpOnly; SameSite=Lax` header. Confirm `refreshToken` does **not** appear in the body.
8. **Protected endpoint rejects:** `curl -i http://localhost:3000/api/auth/me`. Expect `401` and a JSON envelope with `statusCode`, `message`, `error`, `path`, and `timestamp`. **This is the acceptance criterion "Protected APIs reject unauthorized requests."**
9. **Protected endpoint accepts:** repeat with `-H "Authorization: Bearer <accessToken>"`. Expect `200` and a body listing `roles: ["system-administrator"]` and all ten permissions.
10. **Rotation works:** `curl -i -X POST http://localhost:3000/api/auth/refresh -b "crm_refresh=<value>"`. Expect `200`, a different access token, and a different cookie value. Repeat with the **old** cookie — expect `401`, and confirm the log line `Revoked refresh token replayed`.
11. **Logout works:** `curl -i -X POST http://localhost:3000/api/auth/logout -b "crm_refresh=<current value>"`. Expect `204` and a clearing `Set-Cookie`. A refresh with that value afterwards must return `401`.
12. **Lockout works:** post six wrong passwords for the admin, then one correct one. Expect `401` every time and a `Account locked for 15 minutes` log line. Clear it with `UPDATE users SET locked_until = NULL, failed_login_attempts = 0;`.
13. **Passwords never logged:** scan the API's console output from steps 7–12. Expect **no** occurrence of the plaintext password, and no `authorization` or `cookie` header values (the existing `redact` config, `app.module.ts` lines 28–36).
14. **Swagger shows auth:** open `http://localhost:3000/api/docs`. Expect an **Authorize** button, an `auth` tag with four operations, a lock icon on `GET /api/auth/me` but **not** on `POST /api/auth/login`, and a successful "Try it out" on `/api/auth/me` after pasting a token into Authorize.
15. **Regression:** `curl -i http://localhost:3000/api/health` returns `200` with `database.status: "up"` and **no** `Authorization` header needed. `curl -i http://localhost:3000/health` still returns `404`. `curl -i http://localhost:3000/api/nope` still returns `404`, not `401`.
16. **Regression — Story 04 frontend:** with both `npm run dev:api` and `npm run dev:web` running, open `http://localhost:5173/system-status`. It must still show API "Healthy" and Database "Connected". The frontend sends no token yet; the health route is public, so nothing there changes.
17. **Regression:** from the repo root, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.

---

## Done Criteria

- [ ] `@nestjs/jwt` and `cookie-parser` are dependencies of `@crm/api`; `@types/cookie-parser` is a devDependency; no `apps/api/node_modules` exists.
- [ ] `EnvironmentVariables` declares `JWT_ACCESS_SECRET` (`@MinLength(32)`, **no default**), `JWT_ACCESS_TTL` (default `'15m'`, `@Matches`), and `JWT_REFRESH_TTL_DAYS` (default 7, 1–90); the API refuses to boot without the secret.
- [ ] `apps/api/.env.example` documents all three, including the `randomBytes` one-liner for generating a secret.
- [ ] `AuthenticatedUser`, `@Public()`, and `@CurrentUser()` exist at the paths in task 3; `@CurrentUser()` throws rather than returning `undefined` when the guard did not run.
- [ ] `TokenService` stores refresh tokens **only** as a SHA-256 digest, mints them from `randomBytes(32)`, rotates on every `consume`, and revokes **all** of a user's sessions when a revoked token is replayed.
- [ ] `TokenService.revoke` is idempotent and never throws for an unknown token.
- [ ] `AuthService.login` returns the **same** `401` message for unknown email, wrong password, inactive account, and locked account, and verifies against a dummy hash on the unknown-email path.
- [ ] Five consecutive failures lock the account for 15 minutes and reset the counter.
- [ ] `AuthService.loadAuthenticatedUser` reads roles and permissions from the **database**, de-duplicates, sorts, and returns `null` for an inactive user.
- [ ] `LoginResponseDto` contains **no** refresh token; the refresh token appears only in a `Set-Cookie` header with `HttpOnly`, `SameSite=Lax`, and `Path=/api/auth`.
- [ ] `CurrentUserDto` is field-for-field identical to `AuthenticatedUser`.
- [ ] `AuthController` exposes `POST /api/auth/login` (`200`), `POST /api/auth/refresh` (`200`), `POST /api/auth/logout` (`204`), and `GET /api/auth/me`; the first three are `@Public()` and `me` is not.
- [ ] `logout` succeeds with no cookie, an unknown cookie, and a valid cookie.
- [ ] `JwtAuthGuard` is registered via `APP_GUARD` in `AuthModule`, honours `@Public()` at both method and class level, and pins `algorithms: ['HS256']`.
- [ ] A token with `alg: none` or signed with the wrong secret is rejected with `401`.
- [ ] `HealthController` carries `@Public()`, and all five original tests in `health.e2e-spec.ts` pass unchanged.
- [ ] `main.ts` installs `cookieParser()` before the global prefix and the Swagger document declares bearer **and** cookie security schemes; `/api/docs` shows the Authorize button.
- [ ] `req.body.password` is in the pino `redact.paths` array with a comment explaining it is defensive.
- [ ] No plaintext password or token appears in any log line, response body, or error message.
- [ ] All tests in the Test Plan exist and pass; from the repo root `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green.
- [ ] Story 04's System status page still works with no frontend change.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 07.**
