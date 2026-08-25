# Story 07 — RBAC enforcement and the user management API (Story: 2)

## Prerequisites

- [Story 05 completed](05-story-identity-data-model-2.md): the identity tables, the ten seeded permission keys, the six roles with their grants, and `PasswordService`.
- [Story 06 completed](06-story-jwt-authentication-2.md): `JwtAuthGuard` registered as a global `APP_GUARD` in `apps/api/src/auth/auth.module.ts`, `AuthService.loadAuthenticatedUser` populating `request.user` with `roles` and `permissions`, `@Public()` and `@CurrentUser()` decorators, `TokenService.revokeAllForUser`, and Swagger bearer auth.
- **PostgreSQL must be running**, seeded, and the bootstrap administrator's password must be known — every e2e test in this story logs in first.
- This story adds **no migration**. If you find yourself needing a column, stop: it belongs in a revision of Story 05, not here.

---

## Story Goal

Enforce the permission model on every endpoint and ship the administrative API behind it, so an administrator can run the CRM's user base without touching the database.

User-visible outcomes:

1. A request with a valid token but the wrong permission gets **`403`**, distinct from the `401` an unauthenticated request gets.
2. `GET /api/users` returns a paginated, filterable, searchable list of accounts — never a password hash.
3. `POST /api/users` creates an account with roles, a department, and a branch in one call.
4. `PATCH /api/users/:id` edits profile fields; `PATCH /api/users/:id/status` deactivates or reactivates; `PUT /api/users/:id/roles` replaces the role set; `POST /api/users/:id/password` resets a password as an administrator.
5. `GET /api/roles`, `GET /api/departments`, and `GET /api/branches` expose the lookup data the management screen needs, with create/update on the last two.
6. Any signed-in user can read **their own** record even without `users:read`.
7. The system cannot be locked out of itself: the last active administrator cannot be deactivated, demoted, or self-destructed.

**Not in scope:** any frontend change — Story 08. Deleting users (deactivation only, so audit history survives). Self-service password change, forgot-password, MFA, and audit logging: deferred, and recorded in the overview's scope exclusions.

---

## Product rules (from story)

The intake requires "Roles and permissions are enforced" and "Users can be created and managed by an administrator" but leaves the guard rails unstated. These are the decisions.

| Topic | **Decision** | Why |
|---|---|---|
| Enforcement point | A second global guard, `PermissionsGuard`, driven by `@RequirePermissions()` metadata | One place to audit. A service-layer check is invisible in the OpenAPI document and easy to forget on a new route. |
| Missing metadata | A route with **no** `@RequirePermissions()` needs only authentication | Otherwise `GET /api/auth/me` would need a permission nobody has. Authentication is the floor; permissions are per-route. |
| Combining rules | `@RequirePermissions('a', 'b')` means the caller needs **all** of them | "Any of" hides which permission actually mattered. Where an alternative is genuinely needed, express it in the service, not the decorator. |
| Roles vs permissions in guards | Guards check **permissions only**, never role keys | Role membership is data an administrator edits at runtime; hard-coding `'crm-manager'` into a guard makes the role list a code change. The one exception is the escalation rule below. |
| Privilege escalation | Only a caller who **holds** `system-administrator` may grant or revoke `system-administrator` | Otherwise any `crm-manager` with `roles:assign` promotes themselves to full control in one request. This is the sole place a role key appears in application logic. |
| Deletion | **No** `DELETE /api/users`. Deactivation only | A deleted user cascades away their refresh tokens and role grants and leaves dangling references in any future ticket history. |
| Lockout protection | The last **active** user holding `system-administrator` cannot be deactivated, nor have that role removed | A CRM that has locked out its own administrator needs `psql` to recover. |
| Self-service floor | Every authenticated caller may `GET /api/users/<their own id>` | The management screen and the profile header need it, and requiring `users:read` would mean a support agent cannot see their own record. |
| Password on create | Set by the administrator, with `mustChangePassword: true` | Emailed invitation flows need a mailer, which does not exist. The flag carries the obligation forward. |

---

## Context — Read These Files First

1. `apps/api/src/auth/auth.module.ts` (as Story 06 left it) — the `providers` array with `{ provide: APP_GUARD, useClass: JwtAuthGuard }`. Task 1 appends a **second** `APP_GUARD` entry directly after it; **order in this array is the execution order**, and `PermissionsGuard` must run after the guard that populates `request.user`.
2. `apps/api/src/auth/decorators/public.decorator.ts` — the `SetMetadata` + `getAllAndOverride` pattern. `@RequirePermissions()` in task 1 mirrors it exactly.
3. `apps/api/src/auth/guards/jwt-auth.guard.ts` — read `canActivate` end to end, specifically the `isPublic` short-circuit and the `request.user = user` assignment. `PermissionsGuard` reuses the first and depends on the second.
4. `apps/api/src/auth/types/authenticated-user.ts` — the `roles: string[]` and `permissions: string[]` fields the new guard reads.
5. `apps/api/src/auth/auth.service.ts` — `loadAuthenticatedUser`'s nested `select` over `roles → role → permissions → permission` (Story 06, task 5). `UsersService.findMany` uses the **same** shape; copy it rather than inventing a second projection.
6. `apps/api/src/health/health.controller.ts` — all 32 lines. The Swagger decorator density (`@ApiOperation`, `@ApiOkResponse`, `@ApiServiceUnavailableResponse` at lines 18–26) is the house style every new controller matches.
7. `apps/api/src/health/dto/health-response.dto.ts` — all 39 lines. The `@ApiProperty` usage, `!` definite-assignment on every field, and nested `type: () => Dto` at line 37. New DTOs follow this precisely.
8. `apps/api/src/common/filters/all-exceptions.filter.ts` lines 38–47 — how an `HttpException` body becomes the response. A `ConflictException` you throw arrives as `statusCode: 409` with your message; **no filter change is needed** for any status this story introduces.
9. `apps/api/src/main.ts` lines 24–31 — the global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, and `enableImplicitConversion: true`. That last option is what makes numeric query parameters arrive as numbers, so query DTOs need **no** `@Type` decorators.
10. `apps/api/prisma/seed.ts` (as Story 05 left it) — the `permissions` array. **The ten keys there are the complete vocabulary**; `@RequirePermissions()` must never name a key absent from it, because no role could ever satisfy it.
11. Grep for `RequirePermissions` across `apps/api/src` when you finish, and check every hit against that seeded list.

---

## Backend Tasks

### 1 — Permission decorator and guard

**Create file: `apps/api/src/auth/decorators/require-permissions.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'auth:permissions';

/**
 * Requires ALL listed permission keys. Keys must exist in the seeded
 * permissions catalogue (prisma/seed.ts) — a typo here is an endpoint nobody
 * can ever call.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

**Create file: `apps/api/src/auth/guards/permissions.guard.ts`**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // Defensive: JwtAuthGuard is registered first and populates request.user, so
    // this is unreachable in normal operation. Failing closed means a future
    // guard-ordering mistake cannot silently open every protected route.
    if (!user) {
      throw new ForbiddenException('Permission context unavailable.');
    }

    const granted = new Set(user.permissions);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }

    return true;
  }
}
```

Naming the missing permission in the `403` message is a deliberate choice: it is only visible to an **already authenticated** caller, and it turns "why can't I do this" from a support ticket into a self-evident answer. It leaks the permission vocabulary, not any data.

**File: `apps/api/src/auth/auth.module.ts`**

Append a second entry to `providers`, **after** the `JwtAuthGuard` one:

```ts
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
```

**Order is load-bearing.** `PermissionsGuard` reads `request.user`, which `JwtAuthGuard` writes. Reversing these two lines makes every permission-checked route return `403 Permission context unavailable.` — that message exists so this mistake diagnoses itself.

---

### 2 — Shared pagination DTOs

**Create file: `apps/api/src/common/dto/pagination.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 137 })
  total!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;
}
```

`@Max(MAX_PAGE_SIZE)` is the protection that matters: without it `?pageSize=1000000` is a trivial way to make the API read the whole table into memory. It returns `400`, not a clamped value — silently ignoring what the client asked for produces confusing pagination bugs.

No `@Type(() => Number)` is needed. The global pipe sets `enableImplicitConversion: true` (`main.ts` line 29), which converts `?page=2` to the number `2` from the reflected type.

---

### 3 — User DTOs

**Create file: `apps/api/src/users/dto/user-response.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class OrgUnitRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'customer-support' })
  key!: string;

  @ApiProperty({ example: 'Customer Support' })
  name!: string;
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'agent@crm.local' })
  email!: string;

  @ApiProperty({ example: 'Nour Hassan' })
  fullName!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiPropertyOptional({ type: () => OrgUnitRefDto, nullable: true })
  department!: OrgUnitRefDto | null;

  @ApiPropertyOptional({ type: () => OrgUnitRefDto, nullable: true })
  branch!: OrgUnitRefDto | null;

  @ApiProperty({ type: [String], example: ['support-agent'] })
  roles!: string[];

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  lastLoginAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
```

**`UserResponseDto` has no `passwordHash`, no `failedLoginAttempts`, and no `lockedUntil` field, and it never will.** The service builds it from an explicit `select`, not from a spread of the Prisma row — see task 4.

**Create file: `apps/api/src/users/dto/list-users-query.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on email or full name.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 'support-agent' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleKey?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Omit for both.' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
```

`isActive` is a **string** validated by `@IsBooleanString`, converted with `=== 'true'` in the service. A `boolean`-typed query field under `enableImplicitConversion` turns the string `'false'` into `true`, which silently inverts the filter. This is the boolean-from-string foot-gun Story 06 avoided in the environment schema; it is unavoidable here because the value genuinely arrives as a query string, so it is handled explicitly instead.

**Create file: `apps/api/src/users/dto/create-user.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'nour.hassan@crm.local', maxLength: 254 })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Nour Hassan', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ minLength: 12, maxLength: 256 })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  @Matches(/[A-Za-z]/, { message: 'password must contain a letter' })
  @Matches(/\d/, { message: 'password must contain a digit' })
  password!: string;

  @ApiProperty({ type: [String], example: ['support-agent'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  roleKeys!: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
```

`@MinLength(12)` here versus `@MinLength(8)` on `LoginDto` (Story 06, task 6) is intentional: login must accept whatever was already set, while creation sets the floor for new accounts. **Do not** raise `LoginDto`'s minimum to 12 — that would lock out every account created before the rule changed.

`@ArrayNotEmpty()` — a user with no roles can authenticate but do nothing, which reads as a broken account rather than a deliberate state. Assign `customer` for an intentionally permission-less account.

**Create file: `apps/api/src/users/dto/update-user.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Every field optional. `null` on departmentId/branchId clears the assignment —
 * distinguished from "absent" in the service, so a PATCH that omits the field
 * leaves it alone.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 254 })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;
}
```

`@IsOptional()` in class-validator treats `null` as absent, so `@IsUUID()` does not reject an explicit `null`. That is exactly the clearing behaviour wanted; the service distinguishes the two cases with `'departmentId' in dto`.

**Create file: `apps/api/src/users/dto/set-user-roles.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SetUserRolesDto {
  @ApiProperty({ type: [String], example: ['support-agent', 'reporting-user'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  roleKeys!: string[];
}
```

**Create file: `apps/api/src/users/dto/set-user-status.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetUserStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}
```

`@IsBoolean()` in a JSON **body** is safe — `JSON.parse` already produced a real boolean, so no string coercion is involved. The hazard is query strings only.

**Create file: `apps/api/src/users/dto/reset-password.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ minLength: 12, maxLength: 256 })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  @Matches(/[A-Za-z]/, { message: 'password must contain a letter' })
  @Matches(/\d/, { message: 'password must contain a digit' })
  password!: string;
}
```

---

### 4 — Users service

**Create file: `apps/api/src/users/users.service.ts`**

The projection is the important part. Define it once and reuse it everywhere.

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';

export const ADMIN_ROLE_KEY = 'system-administrator';

/**
 * The ONLY projection used for user responses. passwordHash, lockedUntil, and
 * failedLoginAttempts are absent by construction — a `select` cannot leak a
 * column it does not name, which a `spread` of the row would.
 */
const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  department: { select: { id: true, key: true, name: true } },
  branch: { select: { id: true, key: true, name: true } },
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.roleKey) {
      where.roles = { some: { role: { key: query.roleKey } } };
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((row) => UsersService.toResponse(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findOne(id: string, caller: AuthenticatedUser): Promise<UserResponseDto> {
    // Anyone may read their own record; reading anybody else needs users:read.
    if (id !== caller.id && !caller.permissions.includes('users:read')) {
      throw new ForbiddenException('Missing permission: users:read');
    }

    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return UsersService.toResponse(user);
  }

  async create(dto: CreateUserDto, caller: AuthenticatedUser): Promise<UserResponseDto> {
    const roleIds = await this.resolveRoles(dto.roleKeys, caller);
    const email = AuthService.normalizeEmail(dto.email);

    await this.assertOrgUnitsExist(dto.departmentId, dto.branchId);

    try {
      const created = await this.prisma.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          passwordHash: await this.passwordService.hash(dto.password),
          mustChangePassword: true,
          departmentId: dto.departmentId ?? null,
          branchId: dto.branchId ?? null,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        select: USER_SELECT,
      });

      this.logger.log({ actorId: caller.id, userId: created.id }, 'User created');

      return UsersService.toResponse(created);
    } catch (error) {
      throw UsersService.mapPrismaError(error, email);
    }
  }

  async update(id: string, dto: UpdateUserDto, caller: AuthenticatedUser): Promise<UserResponseDto> {
    await this.assertExists(id);
    await this.assertOrgUnitsExist(dto.departmentId ?? undefined, dto.branchId ?? undefined);

    const data: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined) {
      data.email = AuthService.normalizeEmail(dto.email);
    }

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName.trim();
    }

    // `in` rather than a truthiness check: an explicit null must clear the
    // assignment, while an absent key must leave it untouched.
    if ('departmentId' in dto) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }

    if ('branchId' in dto) {
      data.branch = dto.branchId ? { connect: { id: dto.branchId } } : { disconnect: true };
    }

    try {
      const updated = await this.prisma.user.update({ where: { id }, data, select: USER_SELECT });

      this.logger.log({ actorId: caller.id, userId: id }, 'User updated');

      return UsersService.toResponse(updated);
    } catch (error) {
      throw UsersService.mapPrismaError(error, data.email as string | undefined);
    }
  }

  async setStatus(
    id: string,
    isActive: boolean,
    caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    if (!isActive) {
      if (id === caller.id) {
        throw new BadRequestException('You cannot deactivate your own account.');
      }

      await this.assertNotLastAdministrator(id, 'deactivated');
    }

    await this.assertExists(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: isActive
        ? { isActive: true, failedLoginAttempts: 0, lockedUntil: null }
        : { isActive: false },
      select: USER_SELECT,
    });

    if (!isActive) {
      // Deactivation must end live sessions, not just block new logins. The
      // access token is already dead on the next request because
      // loadAuthenticatedUser returns null for an inactive user; this closes
      // the refresh path too.
      await this.tokenService.revokeAllForUser(id);
    }

    this.logger.log({ actorId: caller.id, userId: id, isActive }, 'User status changed');

    return UsersService.toResponse(updated);
  }

  async setRoles(
    id: string,
    dto: SetUserRolesDto,
    caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    await this.assertExists(id);

    const roleIds = await this.resolveRoles(dto.roleKeys, caller);
    const keeping = dto.roleKeys.includes(ADMIN_ROLE_KEY);

    if (!keeping) {
      await this.assertRemovingAdminIsSafe(id, caller);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });

      return tx.user.findUniqueOrThrow({ where: { id }, select: USER_SELECT });
    });

    this.logger.log({ actorId: caller.id, userId: id, roles: dto.roleKeys }, 'User roles replaced');

    return UsersService.toResponse(updated);
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    caller: AuthenticatedUser,
  ): Promise<void> {
    await this.assertExists(id);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await this.passwordService.hash(dto.password),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // A password reset invalidates every existing session, including the
    // caller's own if they reset themselves.
    await this.tokenService.revokeAllForUser(id);

    this.logger.log({ actorId: caller.id, userId: id }, 'Password reset by administrator');
  }

  private async resolveRoles(roleKeys: string[], caller: AuthenticatedUser): Promise<string[]> {
    const unique = [...new Set(roleKeys)];

    // The one place a role key appears in application logic: only an
    // administrator may mint another administrator.
    if (unique.includes(ADMIN_ROLE_KEY) && !caller.roles.includes(ADMIN_ROLE_KEY)) {
      throw new ForbiddenException(`Only a ${ADMIN_ROLE_KEY} can grant ${ADMIN_ROLE_KEY}.`);
    }

    const roles = await this.prisma.role.findMany({
      where: { key: { in: unique } },
      select: { id: true, key: true },
    });

    if (roles.length !== unique.length) {
      const found = new Set(roles.map((role) => role.key));
      const unknown = unique.filter((key) => !found.has(key));
      throw new BadRequestException(`Unknown role key: ${unknown.join(', ')}`);
    }

    return roles.map((role) => role.id);
  }

  private async assertRemovingAdminIsSafe(
    id: string,
    caller: AuthenticatedUser,
  ): Promise<void> {
    const target = await this.prisma.userRole.findFirst({
      where: { userId: id, role: { key: ADMIN_ROLE_KEY } },
      select: { userId: true },
    });

    if (!target) {
      return;
    }

    if (!caller.roles.includes(ADMIN_ROLE_KEY)) {
      throw new ForbiddenException(`Only a ${ADMIN_ROLE_KEY} can revoke ${ADMIN_ROLE_KEY}.`);
    }

    await this.assertNotLastAdministrator(id, 'demoted');
  }

  private async assertNotLastAdministrator(id: string, verb: string): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: {
        id: { not: id },
        isActive: true,
        roles: { some: { role: { key: ADMIN_ROLE_KEY } } },
      },
    });

    const isAdmin = await this.prisma.userRole.findFirst({
      where: { userId: id, role: { key: ADMIN_ROLE_KEY } },
      select: { userId: true },
    });

    if (isAdmin && remaining === 0) {
      throw new BadRequestException(
        `The last active ${ADMIN_ROLE_KEY} cannot be ${verb}. Grant the role to another active user first.`,
      );
    }
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('User not found.');
    }
  }

  private async assertOrgUnitsExist(departmentId?: string, branchId?: string): Promise<void> {
    if (departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!department) {
        throw new BadRequestException('Unknown departmentId.');
      }
    }

    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true },
      });

      if (!branch) {
        throw new BadRequestException('Unknown branchId.');
      }
    }
  }

  private static mapPrismaError(error: unknown, email?: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`A user with the email ${email ?? ''} already exists.`.trim());
    }

    return error instanceof Error ? error : new Error('Unknown persistence error');
  }

  private static toResponse(user: SelectedUser): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      department: user.department,
      branch: user.branch,
      roles: user.roles.map((assignment) => assignment.role.key).sort(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
```

**Details that matter:**

- `USER_SELECT` is declared `satisfies Prisma.UserSelect` and `SelectedUser` is derived with `Prisma.UserGetPayload`. That gives `toResponse` a precise input type, so adding a field to the DTO without adding it to the select is a **compile** error rather than an `undefined` in a response.
- `mode: 'insensitive'` on the search — PostgreSQL `LIKE` is case-sensitive, so without it searching "nour" misses "Nour".
- `list` runs `findMany` and `count` in **one** `$transaction`, so the total cannot disagree with the page under concurrent writes.
- `Math.max(1, …)` on `totalPages` — zero results otherwise report `totalPages: 0`, which every pagination control renders badly.
- `setStatus` checks self-deactivation **before** the last-administrator rule, so an administrator deactivating themselves gets the clearer message.
- `resetPassword` returns `void`; the controller answers `204`. Returning the user tempts a future edit into including something sensitive.
- `assertNotLastAdministrator` counts **active** administrators other than the target. Counting all users would let the system be locked out by deactivating the only *active* administrator while an inactive one exists.

---

### 5 — Users controller

**Create file: `apps/api/src/users/users.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List users', description: 'Paginated, searchable, filterable.' })
  @ApiOkResponse({ type: PaginatedUsersDto })
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    return this.usersService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one user',
    description: 'Any authenticated caller may read their own record; others need users:read.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'No such user.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id, caller);
  }

  @Post()
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or an unknown role/department/branch.' })
  @ApiConflictResponse({ description: 'The email address is already taken.' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Update a user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'The email address is already taken.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto, caller);
  }

  @Patch(':id/status')
  @RequirePermissions('users:deactivate')
  @ApiOperation({
    summary: 'Activate or deactivate a user',
    description: 'Deactivating revokes every refresh token for that user.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Self-deactivation, or the last active administrator.' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.setStatus(id, dto.isActive, caller);
  }

  @Put(':id/roles')
  @RequirePermissions('roles:assign')
  @ApiOperation({
    summary: 'Replace a user role set',
    description: 'PUT, not PATCH: the supplied list becomes the complete role set.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Unknown role key, or the last active administrator.' })
  setRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.setRoles(id, dto, caller);
  }

  @Post(':id/password')
  @RequirePermissions('users:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset a user password as an administrator',
    description: 'Sets mustChangePassword and revokes every session for that user.',
  })
  @ApiNoContentResponse({ description: 'Password replaced.' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.usersService.resetPassword(id, dto, caller);
  }
}
```

**`GET /:id` carries no `@RequirePermissions()`** — the self-or-`users:read` rule is data-dependent, so it lives in the service (task 4, `findOne`). The `PermissionsGuard` still requires authentication, because the route is not `@Public()`.

`ParseUUIDPipe` on every `:id` turns a malformed id into `400` before any query runs. Without it, Prisma raises a Postgres cast error and `AllExceptionsFilter` reports `500`.

`@Put` for roles rather than `@Patch` because the body **replaces** the set. A `PATCH` that silently replaces is the kind of API that deletes a user's roles by accident.

---

### 6 — Roles, departments, and branches

**Create file: `apps/api/src/users/dto/role-response.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'support-agent' })
  key!: string;

  @ApiProperty({ example: 'Support Agent' })
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [String], example: ['departments:read', 'branches:read'] })
  permissions!: string[];

  @ApiProperty({ example: 3, description: 'Active users currently holding this role.' })
  userCount!: number;
}
```

**Create file: `apps/api/src/users/roles.controller.ts`**

One read-only endpoint, `GET /api/roles`, decorated `@RequirePermissions('roles:read')`. It returns every role with its permission keys **sorted** and a count of active holders (`_count` on the `users` relation, filtered to active users — if the filtered `_count` proves awkward, run a second `groupBy` on `userRole`; do **not** fetch every user to count them).

Story 08's role picker renders exactly this payload, so `permissions` must be a plain sorted `string[]`, not the nested `RolePermission` rows.

**Create file: `apps/api/src/org/org.controller.ts`**

Departments and branches share one module because they share one shape.

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/departments` | `departments:read` | All rows, `orderBy: { name: 'asc' }`. Not paginated — the list is small and the frontend needs it whole for its dropdowns. |
| `POST /api/departments` | `departments:write` | `201`. `key` and `name` required; `key` matched against `/^[a-z0-9-]+$/`. `P2002` → `409`. |
| `PATCH /api/departments/:id` | `departments:write` | `name`, `isActive`. **`key` is immutable** — it is the stable identifier the seed upserts on. |
| `GET /api/branches` | `branches:read` | As departments, plus `city`. |
| `POST /api/branches` | `branches:write` | As departments, plus optional `city`. |
| `PATCH /api/branches/:id` | `branches:write` | `name`, `city`, `isActive`. `key` immutable. |

**Create file: `apps/api/src/org/dto/org-unit.dto.ts`** — `CreateDepartmentDto`, `UpdateDepartmentDto`, `CreateBranchDto`, `UpdateBranchDto`, `DepartmentResponseDto`, `BranchResponseDto`. Follow the validator and `@ApiProperty` style of task 3's DTOs exactly; `key` uses `@Matches(/^[a-z0-9-]+$/, { message: 'key must be lower-case letters, digits, and hyphens' })` and `@MaxLength(64)`.

There is **no** delete endpoint for either. Setting `isActive: false` is the retirement path, and `User.department` uses `onDelete: SetNull` (Story 05) precisely so a real delete would silently orphan staff records.

---

### 7 — Register the modules

**Create file: `apps/api/src/users/users.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesController } from './roles.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, RolesController],
  providers: [UsersService],
})
export class UsersModule {}
```

`imports: [AuthModule]` is what supplies `PasswordService` and `TokenService`; Story 06's `AuthModule` exports both. `PrismaService` needs no import — `PrismaModule` is `@Global()` (`prisma.module.ts` line 4).

**Create file: `apps/api/src/org/org.module.ts`** — `controllers: [OrgController]`, `providers: [OrgService]`, no imports beyond what the global Prisma module already provides.

**File: `apps/api/src/app.module.ts`**

Add `UsersModule` and `OrgModule` to the `imports` array after `AuthModule`. The full tail becomes `PrismaModule, AuthModule, UsersModule, OrgModule, HealthModule`.

---

## Edge Cases & Failure Modes

- **Guards registered in the wrong order.** `PermissionsGuard` before `JwtAuthGuard` makes every permission-checked route answer `403 Permission context unavailable.` The message is the diagnosis; fix the `providers` array order in `auth.module.ts` (task 1).
- **`@RequirePermissions()` naming a key that is not seeded** — say `'users:delete'`. No role can satisfy it, so the endpoint is permanently `403` for everyone including the administrator. The ten valid keys are in `prisma/seed.ts`; the closing grep in Context item 11 is the check.
- **Permission granted while the caller is signed in.** Effective on the very next request — the guard reads permissions from the database (Story 06's decision), so there is no staleness window.
- **`401` vs `403`.** No token or a bad token → `401` from `JwtAuthGuard`. Valid token, insufficient permission → `403` from `PermissionsGuard`. Story 08 depends on the distinction: `401` triggers a refresh attempt, `403` shows a "not allowed" message and must **not** log the user out.
- **Duplicate email on create or update.** Prisma raises `P2002`; `mapPrismaError` converts it to `409` with the address. A mixed-case duplicate is caught too, because every write path normalises through `AuthService.normalizeEmail`.
- **Email changed to one that differs only in case** (`Admin@crm.local` when `admin@crm.local` is the caller's own row). Normalisation makes it the same value, so Prisma treats it as a no-op update rather than a conflict.
- **`PATCH` with an empty body `{}`.** Valid: every `UpdateUserDto` field is optional, `data` ends up empty, and Prisma performs a no-op update that still returns the row. Not an error.
- **`departmentId: null` versus an absent `departmentId`.** `null` disconnects, absent leaves it alone. The `'departmentId' in dto` test in `update` is what separates them; a truthiness check would make `null` and absent behave identically and make clearing impossible.
- **Unknown `departmentId` or `branchId`.** `assertOrgUnitsExist` returns `400 Unknown departmentId.` Without it, Prisma's foreign-key violation (`P2003`) would surface as `500`.
- **Unknown role key in `roleKeys`.** `400 Unknown role key: <keys>`, naming every bad key at once rather than failing on the first.
- **Duplicate keys inside `roleKeys`,** e.g. `['support-agent','support-agent']`. Deduplicated by the `Set` in `resolveRoles`. Passing them straight to `createMany` would violate the `@@id([userId, roleId])` composite key with a `P2002`.
- **Privilege escalation.** A `crm-manager` holds `roles:assign` and could otherwise grant themselves `system-administrator`. `resolveRoles` blocks it with `403 Only a system-administrator can grant system-administrator.` Covered by Test Plan item 8.
- **Administrator demotion.** Only an administrator may **revoke** the admin role (`assertRemovingAdminIsSafe`), and never from the last active holder.
- **Self-deactivation.** `400 You cannot deactivate your own account.` Checked before the last-administrator rule, so the message is the specific one.
- **Last active administrator.** Deactivating or demoting them returns `400` naming the remedy. The count deliberately looks only at **active** administrators: an inactive spare cannot sign in to fix anything.
- **A user deactivated while holding a live session.** Access token dies on the next request (`loadAuthenticatedUser` returns `null` for an inactive user) and `setStatus` revokes every refresh token, so the refresh path closes too. There is no window in which a deactivated user keeps working.
- **Administrator resets their own password.** Allowed, and it revokes their own refresh tokens — so the browser is logged out at its next refresh. Correct, and worth a note in Story 08's UI copy.
- **`?pageSize=1000000`.** `400`, from `@Max(MAX_PAGE_SIZE)`. Not clamped: an ignored parameter produces pagination bugs that are far harder to see than a rejected request.
- **`?page=999` beyond the last page.** `200` with `items: []` and honest `meta`. Not a `404`.
- **`?isActive=maybe`.** `400`, from `@IsBooleanString`. `?isActive=false` filters to inactive users, which is the reason that field is a validated string rather than a `boolean`.
- **Unicode and Arabic search terms.** `contains` with `mode: 'insensitive'` uses PostgreSQL `ILIKE`, which handles UTF-8 correctly. Case folding for non-ASCII depends on the database collation — Arabic is caseless so the point is moot, but a Turkish dotted-İ will not fold. Documented, not solved.
- **`%` or `_` in a search term.** Prisma parameterises `contains`, so they are treated as literals, not wildcards. No injection, no accidental match-everything.
- **Malformed UUID in a path.** `ParseUUIDPipe` → `400` before any query. Without it, `500`.
- **A concurrent role change during `setRoles`.** The delete and the re-insert run in one `$transaction`, so no request ever observes a permission-less user mid-swap.
- **No audit trail.** Every mutation emits a structured log line carrying `actorId` and `userId`, which is the poor man's audit log. A real `audit_log` table is out of scope and belongs to its own story.

---

## Test Plan

1. **Unit — `apps/api/src/auth/guards/permissions.guard.spec.ts`** (new). Mock `Reflector`; build a fake `ExecutionContext` as in Story 06's `jwt-auth.guard.spec.ts`.
   - Returns `true` for a `@Public()` route with no `request.user`.
   - Returns `true` when the metadata is `undefined` and when it is `[]`.
   - Returns `true` when the user holds every required permission.
   - Throws `ForbiddenException` naming **only** the missing permission when the user holds one of two.
   - Throws `ForbiddenException('Permission context unavailable.')` when `request.user` is absent on a non-public route with metadata.
2. **Unit — `apps/api/src/users/users.service.spec.ts`** (new). Mock `PrismaService`, `PasswordService`, and `TokenService` with the `useValue` pattern from `health.service.spec.ts` lines 13–29.
   - `list` builds an `OR` over `email` and `fullName` with `mode: 'insensitive'` when `search` is present, and omits `OR` entirely when it is not.
   - `list` maps `isActive: 'false'` to `where.isActive === false` — the regression test for the boolean-string decision.
   - `list` returns `totalPages: 1` for `total: 0`, and `7` for `total: 137, pageSize: 20`.
   - `list` passes `skip: 40` for `page: 3, pageSize: 20`.
   - `toResponse` output has **no** `passwordHash`, `failedLoginAttempts`, or `lockedUntil` key — assert with `Object.keys`.
   - `findOne` resolves for `id === caller.id` when `caller.permissions` is empty, and throws `ForbiddenException` for a different id with the same caller.
   - `create` hashes the password, lower-cases the email, sets `mustChangePassword: true`, and never passes the plaintext to Prisma.
   - `create` maps a `P2002` `PrismaClientKnownRequestError` to `ConflictException`.
   - `update` emits `{ disconnect: true }` for `departmentId: null` and `{ connect: … }` for a real id, and touches neither key when the field is absent.
   - `setStatus(caller.id, false, caller)` throws `BadRequestException`.
   - `setStatus(other, false, caller)` calls `tokenService.revokeAllForUser(other)`; `setStatus(other, true, caller)` does **not**.
   - `resolveRoles` deduplicates, and throws `ForbiddenException` when a non-administrator caller requests `system-administrator`.
   - `resolveRoles` throws `BadRequestException` naming **every** unknown key.
   - `resetPassword` revokes all tokens and sets `mustChangePassword: true`.
3. **Unit — same file.** Last-administrator protection: with the target holding the admin role and the "other active administrators" count mocked to `0`, both `setStatus(target, false, …)` and `setRoles(target, { roleKeys: ['support-agent'] }, …)` throw `BadRequestException`. With the count mocked to `1`, both succeed.
4. **E2E — `apps/api/test/users.e2e-spec.ts`** (new). Reuse Story 06's `beforeAll` wiring **including `cookieParser()`**. Log in as the seeded administrator in `beforeAll` and keep the access token. Create fixtures inside the spec; clean them up in `afterAll` with `prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } })` so the run is repeatable.
   - `GET /api/users` with no token → `401`.
   - `GET /api/users` as the administrator → `200` with `items` and `meta`, and **no** `passwordHash` anywhere in the serialised body (assert on `JSON.stringify(res.body)` not containing `'passwordHash'` or `'scrypt$'`).
   - `POST /api/users` creates an account → `201`, `roles: ['support-agent']`, `mustChangePassword: true`, `isActive: true`.
   - The created user can log in via `POST /api/auth/login` — proves the seed's and the service's hash formats agree.
   - `POST /api/users` with the same email again → `409`.
   - `POST /api/users` with the same email in **upper case** → `409` (normalisation).
   - `POST /api/users` with `roleKeys: ['nope']` → `400`; with `departmentId` set to a random UUID → `400`.
   - `POST /api/users` with an 8-character password → `400`; with `'passwordpassword'` (no digit) → `400`.
   - `GET /api/users?search=<partial upper-case name>` → the created user is found.
   - `GET /api/users?pageSize=1000000` → `400`. `GET /api/users?page=9999` → `200` with `items: []`.
   - `GET /api/users?isActive=false` → does not include the newly created active user.
   - `GET /api/users/not-a-uuid` → `400`.
   - `PATCH /api/users/:id` changing `fullName` → `200` with the new name; sending `{ departmentId: null }` → `department` becomes `null`.
   - `PATCH /api/users/:id/status` with `{ isActive: false }` → `200`, and the user's subsequent login attempt → `401`.
   - `PATCH /api/users/:id/status` targeting the administrator's **own** id → `400`.
   - `PUT /api/users/:id/roles` with `['support-agent','reporting-user']` → `200` with both, sorted.
   - `POST /api/users/:id/password` → `204`, and the user can log in with the new password but not the old one.
5. **E2E — same file.** Permission enforcement from a **restricted** account. Create a `support-agent` (permissions: `departments:read`, `branches:read` only) and log in as them.
   - `GET /api/users` → `403`, and the body `message` names `users:read`.
   - `POST /api/users` → `403`. `PATCH /api/users/:id/status` → `403`. `PUT /api/users/:id/roles` → `403`.
   - `GET /api/users/<their own id>` → `200`. **This is the self-read floor.**
   - `GET /api/users/<the administrator's id>` → `403`.
   - `GET /api/auth/me` → `200` (no permission required).
   - `GET /api/departments` → `200`; `POST /api/departments` → `403`.
   - **The `403` bodies must not be `401`.** Assert the status code explicitly — Story 08's interceptor branches on it.
6. **E2E — same file.** Privilege escalation. As a `crm-manager` (who holds `roles:assign` but not the admin role):
   - `PUT /api/users/<own id>/roles` with `['system-administrator']` → `403`.
   - `POST /api/users` with `roleKeys: ['system-administrator']` → `403`.
   - `PUT /api/users/<a support agent's id>/roles` with `['reporting-user']` → `200`. Escalation is blocked; ordinary assignment is not.
7. **E2E — same file.** Last-administrator protection. The seed leaves exactly **one** administrator, so run this in three ordered steps and assert all three:
   1. As the seeded administrator, `PATCH /api/users/<own id>/status` with `{ isActive: false }` → `400` (self-deactivation is blocked first, so this asserts the self rule, not the last-admin rule).
   2. Create a second account, grant it `system-administrator`, log in as it, and demote the **original** administrator with `PUT /api/users/<original id>/roles` → `200`. One active administrator remains, so this must **succeed**.
   3. Still signed in as that second account — now the **only** administrator — `PUT /api/users/<own id>/roles` with `['crm-manager']` → `400`, with the message naming the remedy. No third account is needed: an administrator demoting themselves exercises the same last-active-administrator guard.

   Restore the seeded administrator's role in `afterAll` so the suite is re-runnable.
8. **E2E — `apps/api/test/org.e2e-spec.ts`** (new).
   - `GET /api/departments` as the administrator → `200` with the two seeded rows.
   - `POST /api/departments` with `{ key: 'e2e-dept', name: 'E2E' }` → `201`; same key again → `409`; `key: 'Not Valid'` → `400`.
   - `PATCH /api/departments/:id` with `{ name: 'Renamed' }` → `200`; with `{ key: 'other' }` → `400` (`forbidNonWhitelisted` rejects the immutable field).
   - The same four for `/api/branches`, plus `city` round-tripping.
   - Clean up in `afterAll` by key prefix.
9. **E2E — `apps/api/test/auth.e2e-spec.ts`** (extend Story 06's file). `GET /api/roles` as the administrator → `200` with 6 roles; `system-administrator` lists all ten permission keys sorted; `customer` lists `[]`. As a `support-agent` → `403`.
10. **E2E — `apps/api/test/health.e2e-spec.ts`** (verify, do not rewrite). All existing tests still pass. Adding `PermissionsGuard` must not touch `/api/health`, because `@Public()` short-circuits it — that short-circuit is Test Plan item 1's first case, tested twice on purpose.

---

## Verification Steps

1. **Backend type-checks:** from `apps/api`, run `npm run typecheck`. Expect exit code 0. The `satisfies Prisma.UserSelect` / `Prisma.UserGetPayload` pairing in `users.service.ts` is what makes a DTO-versus-select mismatch fail **here** rather than in production.
2. **Backend lints:** from `apps/api`, run `npm run lint`. Expect exit code 0.
3. **Backend unit tests:** from `apps/api`, run `npm test`. Expect all specs green, including the two new ones.
4. **Backend e2e tests:** from `apps/api`, run `npm run test:e2e`. Expect `auth`, `users`, `org`, `health`, and `seed` specs all green.
5. **Permission vocabulary audit:** grep `RequirePermissions(` across `apps/api/src` and check every argument against the ten keys in `apps/api/prisma/seed.ts`. Expect zero unmatched keys.
6. **`401` vs `403` by hand:** with `npm run dev:api` running, `curl -i http://localhost:3000/api/users` → `401`. Log in as the administrator, then repeat with the bearer token → `200`. **This pair is the acceptance criterion "Protected APIs reject unauthorized requests."**
7. **Roles are enforced:** create a `support-agent` through `POST /api/users`, log in as them, and `curl -i` `GET /api/users` with their token. Expect **`403`** and a body naming `users:read`. Then `GET /api/users/<their own id>` with the same token — expect `200`. **This pair is the acceptance criterion "Roles and permissions are enforced."**
8. **Administrator can manage users:** as the administrator, create a user, list it, rename it, replace its roles, reset its password, and deactivate it — six calls, all `2xx`. **This is the acceptance criterion "Users can be created and managed by an administrator."**
9. **No hash ever leaves the API:** pipe the full `GET /api/users?pageSize=100` response through `grep -i -e passwordHash -e 'scrypt\$'`. Expect **no** match.
10. **Escalation is blocked:** create a `crm-manager`, log in as them, and `PUT /api/users/<their id>/roles` with `["system-administrator"]`. Expect `403`.
11. **Lockout protection:** as the administrator, `PATCH /api/users/<own id>/status` with `{"isActive": false}`. Expect `400`. Confirm in `psql` that `users.is_active` is still `true`.
12. **Deactivation kills the session:** log in as a test user in one terminal, deactivate them as the administrator in another, then reuse the test user's token. Expect `401`, and expect their refresh cookie to fail too.
13. **Pagination bounds:** `?pageSize=101` → `400`; `?pageSize=100` → `200`; `?page=0` → `400`.
14. **Swagger is complete:** open `http://localhost:3000/api/docs`. Expect `users`, `roles`, and the departments/branches operations grouped under their tags, every one carrying a lock icon, and `PaginatedUsersDto` plus `UserResponseDto` under Schemas with **no** `passwordHash` property.
15. **Regression:** `GET /api/health` still `200` with no token. `GET /api/auth/me` still `200` with a token and `401` without. `GET /api/nope` still `404`.
16. **Regression — Story 04 frontend:** with both dev servers running, `http://localhost:5173/system-status` still shows API "Healthy" and Database "Connected". Nothing in the frontend has changed yet.
17. **Regression:** from the repo root, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.

---

## Done Criteria

- [ ] `@RequirePermissions()` exists at `apps/api/src/auth/decorators/require-permissions.decorator.ts` and requires **all** listed keys.
- [ ] `PermissionsGuard` is registered as a second `APP_GUARD` in `auth.module.ts`, **after** `JwtAuthGuard`; it honours `@Public()`, allows routes with no metadata, and fails closed with `403 Permission context unavailable.` when `request.user` is missing.
- [ ] Every `@RequirePermissions()` argument in the codebase matches one of the ten keys seeded in `prisma/seed.ts`.
- [ ] An authenticated caller lacking a permission gets **`403`**; an unauthenticated caller gets **`401`**. Both are asserted in the e2e suite.
- [ ] `PaginationQueryDto` caps `pageSize` at 100 with a `400`, not a silent clamp; `PaginationMetaDto` reports `page`, `pageSize`, `total`, `totalPages`, with `totalPages` at least 1.
- [ ] `UserResponseDto` has no `passwordHash`, `failedLoginAttempts`, or `lockedUntil` field, and `USER_SELECT` in `users.service.ts` names no such column.
- [ ] `USER_SELECT` uses `satisfies Prisma.UserSelect` and `toResponse` takes a `Prisma.UserGetPayload`-derived type, so a DTO/select mismatch is a compile error.
- [ ] `GET /api/users` supports `page`, `pageSize`, `search` (case-insensitive over email and full name), `roleKey`, `departmentId`, `branchId`, and `isActive`, and runs `findMany` + `count` in one transaction.
- [ ] `isActive` on the query DTO is a `@IsBooleanString` string compared with `=== 'true'`, never a `boolean`.
- [ ] `POST /api/users` hashes the password, lower-cases the email, requires at least one role, sets `mustChangePassword: true`, and returns `409` on a duplicate email in any letter case.
- [ ] `PATCH /api/users/:id` distinguishes an explicit `null` (clear) from an absent field (leave alone) for `departmentId` and `branchId`.
- [ ] `PATCH /api/users/:id/status` refuses self-deactivation and refuses the last active administrator, and revokes every refresh token on deactivation.
- [ ] `PUT /api/users/:id/roles` replaces the set inside one transaction, deduplicates keys, rejects unknown keys with `400` naming all of them, and refuses to leave the system with no active administrator.
- [ ] Only a caller holding `system-administrator` can grant or revoke `system-administrator`; both attempts by a `crm-manager` with `roles:assign` return `403`.
- [ ] `POST /api/users/:id/password` returns `204`, sets `mustChangePassword`, clears the lockout counters, and revokes every session for that user.
- [ ] `GET /api/users/:id` succeeds for the caller's **own** id without `users:read` and returns `403` for anyone else's.
- [ ] Every `:id` route uses `ParseUUIDPipe`, so a malformed id is `400` rather than `500`.
- [ ] `GET /api/roles` requires `roles:read` and returns each role's permission keys as a sorted `string[]`.
- [ ] Departments and branches expose list, create, and update behind `departments:*` / `branches:*`; `key` is immutable and there is **no** delete endpoint.
- [ ] `UsersModule` and `OrgModule` are imported by `AppModule`; `UsersModule` imports `AuthModule` for `PasswordService` and `TokenService`.
- [ ] Every mutation logs a line carrying `actorId` and `userId`, and no log line contains a password or a hash.
- [ ] Swagger shows all new endpoints under `users`, `roles`, `departments`, and `branches`, each with a lock icon, and no schema exposes `passwordHash`.
- [ ] All tests in the Test Plan exist and pass; from the repo root `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green.
- [ ] `/api/health`, `/api/auth/*`, and Story 04's System status page behave exactly as they did after Story 06.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 08.**
