# Story 10 — Customer API: create, read, update, search, filter, archive (Story: 3)

## Prerequisites

- [Story 09 completed](09-story-customer-data-model-3.md): the `Customer` model, the four enums, and the six seeded permission keys. `npm run prisma:generate` must have run, or `Prisma.CustomerSelect` does not exist and nothing here compiles.
- [Story 07 completed](../authentication-and-user-management/07-story-rbac-user-management-api-2.md): `PermissionsGuard` registered as the second global `APP_GUARD`, `@RequirePermissions()`, `@CurrentUser()`, and the `UsersService` shape this story copies almost line for line.
- **PostgreSQL must be running**, migrated, and seeded — every e2e test logs in as the bootstrap administrator first.
- This story adds **no migration**. If you find yourself needing a column, stop: it belongs in a revision of Story 09.

---

## Story Goal

Ship the customer CRUD API behind the permission model, so the profile data a support agent needs exists over HTTP before any screen consumes it.

User-visible outcomes:

1. `GET /api/customers` returns a paginated list, searchable across name, company, email, and phone, filterable by status, type, assigned agent, and city.
2. `GET /api/customers/:id` returns one customer with its assigned agent, its creator, and the counts of its notes, attachments, and interactions.
3. `POST /api/customers` creates a customer with contact details and an optional assigned agent.
4. `PATCH /api/customers/:id` edits any subset of fields, including clearing a nullable one with an explicit `null`.
5. `PATCH /api/customers/:id/status` moves a customer through its lifecycle; reaching **`ARCHIVED`** additionally requires `customers:archive`.
6. Duplicate email is a `409`; an unknown assigned agent is a `400`; an unknown id is a `404`.

**Not in scope:** notes, attachments, and interactions — Story 11 owns their endpoints, and this story only *counts* them. Any frontend file — Story 12. `DELETE /api/customers` — it does not exist and must not be added.

---

## Product rules (from story)

The intake asks for "create, edit and view customers", "customer status", and "search and filtering" without fixing the rules. These are the decisions.

| Topic | **Decision** | Why |
|---|---|---|
| Read permission | One key, `customers:read`, covers the customer and all of its children | Notes and attachments are not separately classified data — a caller who can see the profile can see its history. Splitting the read keys would quadruple the permission catalogue for no enforcement anybody asked for. |
| Ownership scoping | An agent with `customers:read` sees **every** customer, not only their assigned ones | The story is "access customer information … while handling requests", and a support desk routes work between agents constantly. Territory-based row filtering is a real feature with real rules; it is **deliberately excluded** and recorded in the overview. |
| Archiving | `@RequirePermissions('customers:write')` on the route, with an **extra service check** for `customers:archive` when the target status is `ARCHIVED` | The guard reads decorator metadata, which cannot depend on a request body. The precedent is `UsersService.findOne` (`apps/api/src/users/users.service.ts` **lines 103–116**), which likewise refines a route-level rule inside the service. |
| Leaving `ARCHIVED` | Restoring an archived customer **also** requires `customers:archive` | Otherwise the weaker permission un-does the stronger one, and archiving means nothing. |
| Editing an archived customer | Rejected with `400` | An archived record is a historical one. Restore it first — one explicit step instead of a silent edit to something retired. |
| Email normalisation | Lower-cased and trimmed at every write, exactly like `users.email` | The unique index is case-sensitive. `AuthService.normalizeEmail` (**lines 27–29**) is already exported as a static and is reused rather than re-implemented. |
| Phone format | A permissive `@Matches` allowing digits, spaces, `+`, `-`, `(`, `)`, 6–32 characters. **No** normalisation, **no** uniqueness | E.164 parsing needs a library and a country context, neither of which exists here. Storing what the agent typed is honest; pretending to validate is not. |
| `PATCH` semantics | An **absent** key leaves the field alone; an explicit `null` clears it | Identical to `UpdateUserDto`'s contract (`apps/api/src/users/dto/update-user.dto.ts` **lines 4–8**), enforced with `'field' in dto` rather than a truthiness check. |
| List ordering | Fixed: `name` ascending, then `createdAt` descending | A `sortBy` parameter is a query-injection surface and a UI feature nobody asked for. |
| Counts on the list | `_count` for notes, attachments, and interactions is returned on **both** list and detail | One `select` clause, no extra round trip, and the list can show "3 notes" without a follow-up call per row. |

---

## Context — Read These Files First

1. `apps/api/src/users/users.service.ts` — **the primary template for this story; read it end to end (384 lines).** Specifically: `USER_SELECT` with `satisfies Prisma.UserSelect` (**lines 29–42**), `list` with its `where` assembly and `$transaction([findMany, count])` (**lines 54–101**), `create` with `normalizeEmail` and the try/catch around `mapPrismaError` (**lines 118–144**), `update` with the `'departmentId' in dto` idiom (**lines 146–185**), `assertExists` (**lines 330–336**), `mapPrismaError` (**lines 362–368**), and `toResponse` with `.toISOString()` on every date (**lines 370–383**). `CustomersService` is this file with a different noun.
2. `apps/api/src/users/users.controller.ts` — **lines 39–46**, the controller-level decorator stack (`@ApiTags`, `@ApiBearerAuth`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`) every new controller repeats; **lines 47–53**, the `@RequirePermissions` + `@ApiOkResponse` pairing on a list route; **lines 84–95**, a `PATCH` with `ParseUUIDPipe` and `@CurrentUser()`.
3. `apps/api/src/users/dto/list-users-query.dto.ts` — all 31 lines. `extends PaginationQueryDto`, `@IsOptional()` on every field, and **`@IsBooleanString()` for a boolean query parameter**, not `@IsBoolean()`. Copy the reasoning, not just the shape.
4. `apps/api/src/common/dto/pagination.dto.ts` — `DEFAULT_PAGE_SIZE = 20` and `MAX_PAGE_SIZE = 100` (**lines 4–5**), `PaginationQueryDto` (**lines 7–20**), `PaginationMetaDto` (**lines 22–34**). Reuse both classes; do not restate the page fields.
5. `apps/api/src/users/dto/user-response.dto.ts` — all 53 lines. `OrgUnitRefDto` as a nested reference type, `@ApiProperty` on every field with `!` definite assignment, `type: () => Dto` for nesting, and the `PaginatedUsersDto` `{ items, meta }` envelope. The customer DTOs mirror this exactly.
6. `apps/api/src/org/org.service.ts` — **lines 13–31** for two `satisfies Prisma.…Select` constants in one file, and **lines 121–127** for a `mapPrismaError` that takes the entity kind. Useful when Story 11 adds more selects beside yours.
7. `apps/api/src/auth/types/authenticated-user.ts` — all 14 lines. `caller.permissions` is the array the archive check reads; `caller.id` is what lands in `createdById`.
8. `apps/api/src/main.ts` **lines 27–34** — the global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`, and `enableImplicitConversion`. That last option is why numeric query parameters arrive as numbers and query DTOs need **no** `@Type` decorators. **`forbidNonWhitelisted` means an unknown query parameter is a `400`** — every filter the frontend sends must be declared in the DTO.
9. `apps/api/src/app.module.ts` **lines 52–56** — the module list. `CustomersModule` is appended after `OrgModule`.
10. `apps/api/src/main.ts` **lines 46–49** — the `.addTag(...)` calls on the Swagger builder. Add `customers` there.
11. `apps/api/test/users.e2e-spec.ts` — **lines 56–102**, the `beforeAll` that boots a Nest app configured *identically to `main.ts`* (cookie-parser, global prefix, ValidationPipe, exception filter); **lines 104–108**, the `afterAll` that deletes fixtures by a marker suffix; **lines 110–200**, the assertion style. The new e2e spec copies this bootstrap verbatim.
12. Grep for `RequirePermissions` across `apps/api/src` when you finish and check every key against the seeded catalogue in `apps/api/prisma/seed.ts` **lines 41–58**.

---

## Backend Tasks

### 1 — DTOs

**Create file: `apps/api/src/customers/dto/customer-response.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

/** A user referenced from a customer. Deliberately three fields: enough to
 *  render "assigned to Nour Hassan", nothing that leaks account state. */
export class UserRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Nour Hassan' })
  fullName!: string;

  @ApiProperty({ example: 'nour@crm.local' })
  email!: string;
}

export class CustomerCountsDto {
  @ApiProperty({ example: 3 })
  notes!: number;

  @ApiProperty({ example: 1 })
  attachments!: number;

  @ApiProperty({ example: 7 })
  interactions!: number;
}

export class CustomerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CustomerType, example: CustomerType.COMPANY })
  type!: CustomerType;

  @ApiProperty({ example: 'Orten Trading' })
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  companyName!: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'contact@orten.example' })
  email!: string | null;

  @ApiProperty({ required: false, nullable: true, example: '+20 100 000 0000' })
  phone!: string | null;

  @ApiProperty({ required: false, nullable: true })
  alternatePhone!: string | null;

  @ApiProperty({ required: false, nullable: true })
  addressLine1!: string | null;

  @ApiProperty({ required: false, nullable: true })
  addressLine2!: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Cairo' })
  city!: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Egypt' })
  country!: string | null;

  @ApiProperty({ required: false, nullable: true })
  postalCode!: string | null;

  @ApiProperty({ enum: CustomerStatus, example: CustomerStatus.ACTIVE })
  status!: CustomerStatus;

  @ApiPropertyOptional({ type: () => UserRefDto, nullable: true })
  assignedAgent!: UserRefDto | null;

  @ApiPropertyOptional({ type: () => UserRefDto, nullable: true })
  createdBy!: UserRefDto | null;

  @ApiProperty({ type: () => CustomerCountsDto })
  counts!: CustomerCountsDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedCustomersDto {
  @ApiProperty({ type: [CustomerResponseDto] })
  items!: CustomerResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
```

Importing `CustomerStatus` and `CustomerType` from `@prisma/client` keeps the enum in **one** place. If those imports fail, Story 09's `prisma generate` did not run.

**Create file: `apps/api/src/customers/dto/create-customer.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Digits, spaces, and the punctuation a human types. Deliberately NOT E.164:
 *  parsing that needs a country context this application does not have. */
export const PHONE_PATTERN = /^[+0-9][0-9 ()\-]{5,31}$/;
export const PHONE_MESSAGE = 'phone must be 6–32 characters of digits, spaces, +, -, ( and )';

export class CreateCustomerDto {
  @ApiPropertyOptional({ enum: CustomerType, default: CustomerType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiProperty({ example: 'Orten Trading', minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiPropertyOptional({ maxLength: 254 })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '+20 100 000 0000' })
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  alternatePhone?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine1?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine2?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.PROSPECT })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;
}
```

**Create file: `apps/api/src/customers/dto/update-customer.dto.ts`**

Every field optional and **nullable** where the column is. Do **not** reach for `PartialType(CreateCustomerDto)`: it would inherit `status`, which must move only through the dedicated status route, and it cannot express "explicit `null` clears the field".

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PHONE_MESSAGE, PHONE_PATTERN } from './create-customer.dto';

/**
 * Every field optional. `null` on a nullable field CLEARS it — distinguished
 * from "absent" in the service with `'field' in dto`, so a PATCH that omits a
 * key leaves it alone. Status is NOT here: it moves through
 * PATCH /api/customers/:id/status, which carries the archive rule.
 */
export class UpdateCustomerDto {
  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ minLength: 2, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string | null;

  @ApiPropertyOptional({ maxLength: 254, nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string | null;

  // …phone, alternatePhone, addressLine1, addressLine2, city, country,
  // postalCode: same decorators as CreateCustomerDto, each `?: string | null`.

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string | null;
}
```

**`@IsOptional()` treats `null` as absent for validation purposes**, which is exactly what allows a `null` through to the service — where `'field' in dto` then tells the two cases apart. This is the same mechanism `UpdateUserDto` relies on.

**Create file: `apps/api/src/customers/dto/set-customer-status.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetCustomerStatusDto {
  @ApiProperty({ enum: CustomerStatus, example: CustomerStatus.ACTIVE })
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;
}
```

**Create file: `apps/api/src/customers/dto/list-customers-query.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListCustomersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on name, company, email, or phone.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;
}
```

An unknown query key is a **`400`** because of `forbidNonWhitelisted` — the frontend in Story 12 may send only these five plus `page` and `pageSize`.

### 2 — `CustomersService`

**Create file: `apps/api/src/customers/customers.service.ts`**

Structure it exactly as `UsersService` is structured: a module-level `CUSTOMER_SELECT`, a `SelectedCustomer` payload type, public methods, then private assertions, then two statics.

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto, PaginatedCustomersDto } from './dto/customer-response.dto';

export const ARCHIVE_PERMISSION = 'customers:archive';

const USER_REF_SELECT = { id: true, fullName: true, email: true } satisfies Prisma.UserSelect;

/** The ONLY projection used for customer responses. Explicit, so a column added
 *  to the model later cannot leak into an API response by accident. */
const CUSTOMER_SELECT = {
  id: true,
  type: true,
  name: true,
  companyName: true,
  email: true,
  phone: true,
  alternatePhone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  country: true,
  postalCode: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  assignedAgent: { select: USER_REF_SELECT },
  createdBy: { select: USER_REF_SELECT },
  _count: { select: { notes: true, attachments: true, interactions: true } },
} satisfies Prisma.CustomerSelect;

type SelectedCustomer = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>;
```

Methods:

**`list(query: ListCustomersQueryDto): Promise<PaginatedCustomersDto>`** — mirror `UsersService.list` (**lines 54–101**) exactly.

```ts
    const where: Prisma.CustomerWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
```

`phone` gets **no** `mode: 'insensitive'` — digits have no case, and the flag would cost a `LOWER()` on every row for nothing. Then `status`, `type`, `assignedAgentId`, and `city` (`{ contains: query.city, mode: 'insensitive' }`) as plain equality/contains clauses, and:

```ts
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
```

Return `{ items, meta }` with `totalPages: Math.max(1, Math.ceil(total / query.pageSize))` — the same expression as `users.service.ts` line 98, so an empty list still reports one page.

**`findOne(id: string): Promise<CustomerResponseDto>`** — `findUnique` with `CUSTOMER_SELECT`; `NotFoundException('Customer not found.')` when absent. No caller-based branching: `customers:read` on the route is the whole rule.

**`create(dto, caller): Promise<CustomerResponseDto>`**

- `await this.assertAgentExists(dto.assignedAgentId)`.
- Normalise: `const email = dto.email ? AuthService.normalizeEmail(dto.email) : null;`
- `name: dto.name.trim()`, and trim every other supplied string field.
- Set `createdById: caller.id`.
- Wrap `prisma.customer.create` in try/catch and re-throw `CustomersService.mapPrismaError(error, email)`.
- `this.logger.log({ actorId: caller.id, customerId: created.id }, 'Customer created');` — the structured-log shape Story 07 established as the substitute for an audit table.

**`update(id, dto, caller): Promise<CustomerResponseDto>`**

- `await this.assertExists(id)` — but capture the current `status` from that same query and reject with `BadRequestException('An archived customer cannot be edited. Restore it first.')` when it is `ARCHIVED`. One query, both jobs.
- `await this.assertAgentExists(dto.assignedAgentId ?? undefined)`.
- Build `Prisma.CustomerUpdateInput` with the `'field' in dto` idiom for **every** nullable field:

```ts
    if ('companyName' in dto) {
      data.companyName = dto.companyName ?? null;
    }

    if ('assignedAgentId' in dto) {
      data.assignedAgent = dto.assignedAgentId
        ? { connect: { id: dto.assignedAgentId } }
        : { disconnect: true };
    }
```

  `name` and `type` are non-nullable: assign them only when `!== undefined`, and `.trim()` the name.
- Same try/catch → `mapPrismaError`, same structured log with `'Customer updated'`.

**`setStatus(id, status, caller): Promise<CustomerResponseDto>`**

```ts
    const current = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!current) {
      throw new NotFoundException('Customer not found.');
    }

    // The guard cannot see the request body, so the archive rule lives here.
    // Both directions are gated: a caller who may not archive may not restore
    // either, or the weaker permission silently undoes the stronger one.
    const touchesArchive =
      status === CustomerStatus.ARCHIVED || current.status === CustomerStatus.ARCHIVED;

    if (touchesArchive && !caller.permissions.includes(ARCHIVE_PERMISSION)) {
      throw new ForbiddenException(`Missing permission: ${ARCHIVE_PERMISSION}`);
    }
```

Then update, log `{ actorId, customerId, from: current.status, to: status }`, and return. A no-op transition (same status in and out) is allowed and idempotent.

Private helpers:

- `assertExists(id)` → returns the row's `{ id, status }` or throws `NotFoundException('Customer not found.')`.
- `assertAgentExists(assignedAgentId?)` → when supplied, `prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } })`; **`BadRequestException('Unknown assignedAgentId.')`** when missing, and the same when `isActive` is false with the message `'Cannot assign an inactive user.'` Modelled on `assertOrgUnitsExist` (**lines 338–360**).

Statics:

- `mapPrismaError(error, email?)` → `P2002` becomes `ConflictException(\`A customer with the email ${email ?? ''} already exists.\`.trim())`. Copy `users.service.ts` **lines 362–368**.
- `toResponse(customer: SelectedCustomer): CustomerResponseDto` → spread nothing; name every field, map `_count` to `counts`, and `.toISOString()` both dates. Copy the shape at **lines 370–383**.

### 3 — `CustomersController`

**Create file: `apps/api/src/customers/customers.controller.ts`**

Repeat the controller-level decorator stack from `users.controller.ts` **lines 39–46**, with `@ApiTags('customers')` and `@Controller('customers')`.

| Method | Route | `@RequirePermissions` | Notes |
|---|---|---|---|
| `list` | `GET /` | `customers:read` | `@Query() query: ListCustomersQueryDto` → `PaginatedCustomersDto` |
| `findOne` | `GET /:id` | `customers:read` | `@Param('id', ParseUUIDPipe)`; `@ApiNotFoundResponse` |
| `create` | `POST /` | `customers:write` | `@ApiCreatedResponse`, `@ApiConflictResponse`; `@CurrentUser() caller` |
| `update` | `PATCH /:id` | `customers:write` | `@ApiConflictResponse`, `@ApiBadRequestResponse` |
| `setStatus` | `PATCH /:id/status` | `customers:write` | `@ApiForbiddenResponse({ description: 'Archiving or restoring needs customers:archive.' })` |

**There is no `@Delete`.** A malformed uuid is a `400` from `ParseUUIDPipe` before the service runs — that is why every route uses it.

Document the archive rule in the `setStatus` `@ApiOperation({ description: … })` so it is visible in `/api/docs`, where the frontend developer will look for it.

### 4 — Module wiring

**Create file: `apps/api/src/customers/customers.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
```

`AuthModule` is imported for `AuthService.normalizeEmail` — the same reason `UsersModule` imports it (`apps/api/src/users/users.module.ts` line 8). `exports` is there because Story 11's controllers reuse `CustomersService.assertExists` through the service.

**File: `apps/api/src/app.module.ts`** — add the import and place `CustomersModule` after `OrgModule` in the `imports` array (**line 55**). `PrismaModule` is already global-ish by position; follow the existing ordering rather than inventing one.

**File: `apps/api/src/main.ts`** — add `.addTag('customers', 'Customer profiles and their history')` to the `DocumentBuilder` chain beside the existing tags (**lines 46–49**).

---

## Edge Cases & Failure Modes

- **Duplicate email, differing case.** `POST` with `Contact@Orten.example` when `contact@orten.example` exists → `409`, because the service lower-cases before the insert. Without the normalisation it would be a second row and a silent data-quality bug. Enforced in `create`/`update` via `AuthService.normalizeEmail` (`apps/api/src/auth/auth.service.ts` **lines 27–29**).
- **Two customers with no email.** Both succeed — the nullable unique index permits it (Story 09). An e2e test pins this so nobody "fixes" the schema later.
- **Clearing an email.** `PATCH { "email": null }` sets the column to `NULL` and frees the address for another customer. `PATCH {}` leaves it untouched. Both paths run through the `'email' in dto` branch in `update`.
- **Assigning an inactive agent.** `400` with "Cannot assign an inactive user." Deactivated staff must not accumulate new work; existing assignments are left alone because the column is `SetNull` only on deletion, which never happens.
- **Archiving without `customers:archive`.** `403` from the service, **not** the guard — the route-level requirement (`customers:write`) already passed. The message names the missing key, matching `PermissionsGuard`'s wording (`apps/api/src/auth/guards/permissions.guard.ts` line 44) so the frontend's `toErrorMessage` renders it identically.
- **Editing an archived customer.** `400` with "An archived customer cannot be edited. Restore it first." Restoring is itself gated, so a `support-supervisor` genuinely cannot touch archived records — that is the intent, not an oversight.
- **`search` with `%` or `_`.** Prisma's `contains` parameterises the value; it does **not** become a LIKE wildcard and cannot inject SQL. A literal `%` matches a literal `%`.
- **Unicode search.** `contains` + `mode: 'insensitive'` maps to `ILIKE`, whose case-folding for Arabic and other non-Latin scripts depends on the database collation. Latin and Arabic substring search both work; case-insensitivity is only meaningful where the script has case. Do not add a `LOWER()` in application code to "fix" this — it defeats any future index.
- **`page=9999` on 12 customers.** `200` with `items: []` and honest `meta`. Never a `404`; the users API behaves identically and Story 12's pagination depends on it.
- **`pageSize=1000000`.** `400` from `MAX_PAGE_SIZE = 100` in the inherited `PaginationQueryDto`.
- **An unknown query parameter** (`?sortBy=name`) → `400` from `forbidNonWhitelisted`. Story 12 must send only the declared keys, and the empty-string-means-omitted mapping in its store is what keeps that true.
- **Concurrent edits.** Last write wins; there is no optimistic-concurrency token. Two agents editing one customer simultaneously silently overwrite each other's fields. **Deliberately accepted** at this scale — recorded here so it is a decision rather than a surprise.
- **A customer deleted between `assertExists` and `update`.** Prisma raises `P2025`, which is not mapped and surfaces as a `500`. It requires a delete that this API does not expose, so the only route to it is manual `psql` — acceptable, and noted so the log line is recognisable.

---

## Test Plan

1. **Unit — new file `apps/api/src/customers/customers.service.spec.ts`.** Follow `apps/api/src/users/users.service.spec.ts` **lines 1–70** precisely: the `containing`/`notContaining` wrappers around jest's asymmetric matchers, a `baseCustomerRow` fixture, a `buildCaller()` helper, and a hand-rolled `prisma` mock object rather than a real client.
   - `list` with no filters builds an **empty** `where` and passes `skip: 0`, `take: 20`.
   - `list` with `search` builds an `OR` over `name`, `companyName`, `email`, and `phone`, and the `phone` clause carries **no** `mode: 'insensitive'`.
   - `list` with `status` and `type` adds equality clauses; with `city` adds `contains`.
   - `list` computes `totalPages` as 1 when `total` is 0.
   - `create` lower-cases the email, trims the name, and sets `createdById` from the caller.
   - `create` with no email passes `email: null`, not `undefined`.
   - `create` rethrows a `P2002` as a `ConflictException` — construct `new Prisma.PrismaClientKnownRequestError(...)` the way the users spec does.
   - `create` with an unknown `assignedAgentId` throws `BadRequestException` and **never calls** `prisma.customer.create`.
   - `create` with an inactive agent throws `BadRequestException`.
   - `update` with `{ companyName: null }` sends `null`; `update` with `{}` sends an update payload that does **not** contain a `companyName` key — use `notContaining`.
   - `update` on an `ARCHIVED` row throws `BadRequestException` before touching `prisma.customer.update`.
   - `setStatus` to `ARCHIVED` without `customers:archive` throws `ForbiddenException`; **with** it, succeeds.
   - `setStatus` **away from** `ARCHIVED` without the permission also throws — the both-directions rule.
   - `setStatus` to the same status the row already has succeeds.
   - `toResponse` maps `_count` into `counts` and emits ISO strings for `createdAt` and `updatedAt`.
2. **Integration — new file `apps/api/test/customers.e2e-spec.ts`.** Copy the `beforeAll` bootstrap from `apps/api/test/users.e2e-spec.ts` **lines 56–102** verbatim. Create fixtures with names prefixed `E2E ` and emails ending `@e2e.local`, and clean both up in `afterAll` with `customer.deleteMany` on those markers, mirroring **lines 104–108**.
   - `GET /api/customers` with no token → **401**.
   - `GET /api/customers` as the administrator → **200**, `items` an array, `meta` containing `page: 1, pageSize: 20`.
   - `POST /api/customers` with `{ name }` only → **201**, `status: 'PROSPECT'`, `type: 'INDIVIDUAL'`, `counts` all zero.
   - `POST` with full contact details → **201**, and the response echoes them.
   - `POST` with `email: 'E2E.Dup@e2e.local'` then the same address lower-cased → **409**.
   - Two `POST`s with **no** email → both **201**.
   - `POST` with `assignedAgentId: randomUUID()` → **400**.
   - `POST` with `phone: 'not a phone'` → **400**.
   - `POST` with `name: 'A'` → **400** (minimum length).
   - `GET /api/customers/:id` → **200** with `assignedAgent`, `createdBy`, and `counts`.
   - `GET /api/customers/not-a-uuid` → **400**; `GET /api/customers/<random uuid>` → **404**.
   - `PATCH /api/customers/:id` changing `name` and clearing `city` with `null` → **200**, `city: null`.
   - `GET /api/customers?search=<partial name, wrong case>` finds the fixture.
   - `GET /api/customers?search=<partial phone>` finds it.
   - `GET /api/customers?status=ACTIVE` excludes a `PROSPECT` fixture.
   - `GET /api/customers?sortBy=name` → **400**, the `forbidNonWhitelisted` proof.
   - `GET /api/customers?pageSize=1000000` → **400**; `?page=9999` → **200** with `items: []`.
   - `PATCH /api/customers/:id/status` to `ACTIVE` as the administrator → **200**.
   - `PATCH …/status` to `ARCHIVED` as the administrator → **200**; a subsequent `PATCH /api/customers/:id` → **400**.
   - **Restricted-caller block.** Create a `support-supervisor` (no `customers:archive`) through `POST /api/users` and log in as them, following the `describe('permission enforcement from a restricted account')` pattern at `users.e2e-spec.ts` **line 307**. Assert: `GET /api/customers` → 200; `POST /api/customers` → 201; `PATCH …/status` to `ARCHIVED` → **403**; and restoring an already-archived customer → **403**.
   - **A `customer`-role account** (zero permissions) gets **403** on `GET /api/customers`.
   - `JSON.stringify(response.body)` for any customer route contains neither `passwordHash` nor `scrypt$` — the same leak check the users suite runs, because `assignedAgent` embeds a user.
3. **No frontend test.** Story 12 owns those.

---

## Verification Steps

1. **Backend builds:** from `apps/api`, run `npm run build`. Expect exit code 0.
2. **Backend type-checks and lints:** from `apps/api`, `npm run typecheck` and `npm run lint`. Both exit 0.
3. **Unit tests:** from `apps/api`, `npm test`. Green, including the new service spec.
4. **e2e tests:** from `apps/api`, `npm run test:e2e` with PostgreSQL running and seeded. Green, including `customers.e2e-spec.ts`.
5. **Permission keys are real:** grep `apps/api/src` for `RequirePermissions` and check every key against the `permissions` array in `apps/api/prisma/seed.ts`. Expect `customers:read` and `customers:write` to appear and **nothing** invented.
6. **Swagger:** start the API (`npm run dev:api`) and open `http://localhost:3000/api/docs`. Expect a **customers** tag with five operations, `CustomerResponseDto` showing `status` as an enum with four values, and the archive rule visible in the `PATCH /api/customers/{id}/status` description.
7. **Manual — create and read:** in Swagger, authorise with a bearer token from `POST /api/auth/login`, then `POST /api/customers` with a name, an email, and a phone. Expect **201**. `GET /api/customers/{id}` returns it with `counts` all zero and `createdBy` naming you.
8. **Manual — search:** create a second customer, then `GET /api/customers?search=` with a lower-cased fragment of the first customer's upper-cased name. Expect exactly that customer back. **This is the acceptance criterion "Customer search and filtering work."**
9. **Manual — filter:** `PATCH /api/customers/{id}/status` to `ACTIVE`, then `GET /api/customers?status=PROSPECT`. Expect the activated customer to be absent and the other present.
10. **Manual — archive gate:** create a `support-supervisor` user, sign in as them, and `PATCH …/status` to `ARCHIVED`. Expect **403** naming `customers:archive`. Repeat as the administrator — expect **200**.
11. **Regression:** `GET /api/users`, `GET /api/roles`, `GET /api/departments`, and `GET /api/health` all still behave as before, and `POST /api/auth/login` still issues a token. This story touched `app.module.ts` and `main.ts`; those are the files that could break them.
12. **Regression:** from the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.
13. **Regression:** confirm `npx prisma migrate status` from `apps/api` reports no pending migrations — this story must have added none.

---

## Done Criteria

- [ ] `apps/api/src/customers/` contains `customers.module.ts`, `customers.service.ts`, `customers.controller.ts`, and five DTO files under `dto/`.
- [ ] `CustomersModule` is imported in `apps/api/src/app.module.ts` and a `customers` tag is registered in `apps/api/src/main.ts`.
- [ ] `CUSTOMER_SELECT` is the single projection used by every read path and is declared with `satisfies Prisma.CustomerSelect`.
- [ ] `GET /api/customers` paginates with the shared `PaginationQueryDto`, searches name / company / email / phone, and filters by status, type, assigned agent, and city.
- [ ] `GET /api/customers/:id` returns `assignedAgent`, `createdBy`, and `counts` for notes, attachments, and interactions.
- [ ] `POST /api/customers` sets `createdById` from `@CurrentUser()`, lower-cases the email, and returns **201**.
- [ ] `PATCH /api/customers/:id` distinguishes an absent key from an explicit `null` using `'field' in dto`, and rejects edits to an `ARCHIVED` customer with **400**.
- [ ] `PATCH /api/customers/:id/status` requires `customers:archive` for **both** entering and leaving `ARCHIVED`, enforced in the service with a `403` naming the key.
- [ ] A duplicate email is **409**; an unknown or inactive `assignedAgentId` is **400**; an unknown id is **404**; a malformed id is **400**.
- [ ] **No `DELETE` route exists** anywhere under `/api/customers` — verified by grepping the controller for `@Delete`.
- [ ] Every mutation emits a structured log line carrying `actorId` and `customerId`.
- [ ] The unit spec covers the `where` assembly, the null-versus-absent contract, the archive rule in both directions, and the `P2002` mapping; the e2e spec covers every row of the Test Plan including the restricted-caller block.
- [ ] No response body from any customer route contains a password hash.
- [ ] This story added **no** migration and modified **no** frontend file.
- [ ] From the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 11.**
