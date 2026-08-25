# Story 14 — Ticket API: create, read, update, search, filter, status (Story: 4)

## Prerequisites

- [Story 13 completed](13-story-ticket-data-model-4.md): the `Ticket` model, its enums, and the `tickets:*`/`ticket-*:write` permission keys must exist in the database before this story's guards can be tested end-to-end.
- Coordinate with anyone editing `apps/api/src/app.module.ts` or `apps/api/src/main.ts` concurrently — this story registers a new module and Swagger tags there.

## Story Goal

1. `TicketsController`/`TicketsService` expose `GET /api/tickets` (paginated, searchable, filterable), `GET /api/tickets/:id`, `POST /api/tickets`, `PATCH /api/tickets/:id`, and `PATCH /api/tickets/:id/status`.
2. `TicketsService.update()` and `TicketsService.setStatus()` write `TicketHistory` rows as a side effect whenever `category`, `priority`, `assignedAgentId`, or `status` actually changes.
3. `TicketsService.assertExists` is exported (public) so Story 15's comment/attachment/history services can reuse it, exactly as `CustomersService.assertExists` is reused by Story 11's services.
4. Register `TicketsModule` in `app.module.ts`, add its Swagger tag in `main.ts`.

**Not in scope:** the nested comment/attachment/history routes (Story 15) and any frontend change (Story 16). No `DELETE /api/tickets/:id` route — tickets are never deleted (see [00-overview.md](00-overview.md)).

## Context — Read These Files First

1. [`.squad/plans/customer-management/10-story-customer-api-3.md`](../customer-management/10-story-customer-api-3.md) — the direct template for this story's task shape (DTOs → service → controller → module wiring), its Product rules table, Edge Cases, and Test Plan sections.
2. [`apps/api/src/customers/customers.controller.ts`](../../../apps/api/src/customers/customers.controller.ts) — full file (102 lines). The five routes (`list` lines 32–41, `findOne` lines 43–50, `create` lines 52–65, `update` lines 67–82, `setStatus` lines 84–100) are the route-for-route template for `TicketsController`. Note there is no `@Delete` route.
3. [`apps/api/src/customers/customers.service.ts`](../../../apps/api/src/customers/customers.service.ts) — full file (346 lines). Study: the exported `USER_REF_SELECT` constant (lines 20–24, **import this directly** rather than redefining it — `import { USER_REF_SELECT } from '../customers/customers.service';`); the `CUSTOMER_SELECT` projection pattern (lines 26–49); the `'field' in dto` null-vs-absent idiom in `update()` (lines 178–220, especially the `assignedAgentId` handling at lines 217–220 — `TicketsService.update()` uses the identical idiom for its own `assignedAgentId`); the public `assertExists` method (lines 277–288) and its comment explaining why it is public; the private `assertAgentExists` method (lines 290–307, checks the referenced user exists and `isActive`) — `TicketsService` needs an equivalent private method and should not import the customer one (it is private there).
4. [`apps/api/src/customers/dto/`](../../../apps/api/src/customers/dto/) — read `create-customer.dto.ts` (93 lines), `update-customer.dto.ts` (91 lines), `list-customers-query.dto.ts` (34 lines), `set-customer-status.dto.ts` (10 lines), and `customer-response.dto.ts` (92 lines, especially `UserRefDto` at lines 7–16 — **import this directly**: `import { UserRefDto } from '../../customers/dto/customer-response.dto';`) in full. These are the field-by-field templates for the five new ticket DTO files.
5. [`apps/api/src/common/dto/pagination.dto.ts`](../../../apps/api/src/common/dto/pagination.dto.ts) — full file (34 lines). `PaginationQueryDto` (page/pageSize with defaults 1/20, max pageSize 100) and `PaginationMetaDto` are reused unchanged — `ListTicketsQueryDto extends PaginationQueryDto`.
6. [`apps/api/src/auth/decorators/current-user.decorator.ts`](../../../apps/api/src/auth/decorators/current-user.decorator.ts) and [`require-permissions.decorator.ts`](../../../apps/api/src/auth/decorators/require-permissions.decorator.ts) — both full files (19 and 12 lines). `@CurrentUser() caller: AuthenticatedUser` and `@RequirePermissions('tickets:read')` are used exactly as in the customer controller.
7. [`apps/api/src/auth/types/authenticated-user.ts`](../../../apps/api/src/auth/types/authenticated-user.ts) — full file (15 lines). `caller.permissions: string[]` is what `TicketsService.setStatus` and later Story 15 check against `TICKET_MANAGE_PERMISSION`.
8. [`apps/api/src/customers/customers.module.ts`](../../../apps/api/src/customers/customers.module.ts) — full file (31 lines). `TicketsModule` follows the same shape: `imports: [AuthModule, CustomersModule]` (new — `TicketsService` needs `CustomersService` to validate `customerId` on create), `exports: [TicketsService]` (so Story 15 can inject it).
9. [`apps/api/src/app.module.ts`](../../../apps/api/src/app.module.ts) — full file (62 lines). `CustomersModule` is imported at line 11 and listed at line 57; add `TicketsModule` the same way, after `CustomersModule`.
10. [`apps/api/src/main.ts`](../../../apps/api/src/main.ts) — full file (66 lines). The Swagger `.addTag(...)` chain (lines 46–51) lists `customers`, `customer-notes`, `customer-attachments`, `customer-interactions`; add `tickets` after `customer-interactions` (Story 15 adds `ticket-comments`, `ticket-attachments`, `ticket-history` in the same chain).
11. Grep for `containing(` and `buildCaller(` in `apps/api/src/customers/customers.service.spec.ts` — this is the unit-test fixture/mock style to replicate for `tickets.service.spec.ts`.
12. Grep for the bootstrap block in `apps/api/test/customers.e2e-spec.ts` (its first ~50 lines) and `apps/api/test/users.e2e-spec.ts` (lines 56–102 per Story 10's plan) — this is the e2e bootstrap/cleanup pattern for `tickets.e2e-spec.ts`.

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | One read key. `tickets:read` covers the ticket and its counts; Story 15's comments/attachments/history also gate on `tickets:read` for their `GET` routes. | Same "one read key" decision as `customers:read`. |
| 2 | No archive-style dual-direction gating on `setStatus`. Any `tickets:write` holder can set any `TicketStatus` value. | Unlike `customers:archive`, no `TicketStatus` value is treated as sensitive — see [00-overview.md](00-overview.md). |
| 3 | `assignedAgentId` moves through the general `PATCH /tickets/:id` route using the `'field' in dto` idiom, not a dedicated `/assign` route. | Mirrors exactly how `Customer.assignedAgentId` is handled — no new route shape is invented where the existing pattern already fits. |
| 4 | `category`, `priority`, and `assignedAgentId` changes each produce a `TicketHistory` row **only when the value actually changes** (diff old vs. new inside the same transaction as the update). `status` changes produce a `TicketHistory` row the same way inside `setStatus()`. | An audit trail that logs no-op writes (e.g. `PATCH` re-sending the same `priority`) is noise, not history. |
| 5 | `customerId` is validated on `create()` with a dedicated `assertCustomerExists` check that throws `BadRequestException('Unknown customerId.')`, **not** `CustomersService.assertExists` (which throws `NotFoundException` and is meant for URL path parameters, not a body field referencing another entity). | Mirrors `CustomersService.assertAgentExists`'s use of `BadRequestException` for exactly the same reason: a bad foreign-key reference in the request body is a validation failure of the request, not a "resource not found at this URL" failure. |
| 6 | `subject` (`@MinLength(2) @MaxLength(160)`) and `description` (`@MinLength(1) @MaxLength(8000)`) are both required on create, both optional on update. | Mirrors `name`'s required-on-create/optional-on-update shape on `Customer`, and `body`'s length caps on `CustomerInteraction`. |
| 7 | Fixed ordering: `createdAt desc` (newest first), no `sortBy` query parameter. | Simpler than customer's `name asc, createdAt desc` because there is no natural "name" field to sort tickets by; newest-first is the expected default for a work queue. |
| 8 | `_count` (as `counts` in the response) returns `comments`, `attachments`, `history` on both list and detail responses. | Matches the `counts` shape on `CustomerResponseDto`. |
| 9 | The embedded `customer` reference in `TicketResponseDto` is a small `CustomerRefDto` (`id`, `name`, `email`), not the full `CustomerResponseDto`. | Mirrors why `UserRefDto` is three fields, not the full `User` — enough to render "Orten Trading" as a link, nothing that duplicates the customer API's own response shape. |

## Backend Tasks

### 1 — DTOs

**Create file: `apps/api/src/tickets/dto/ticket-response.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { UserRefDto } from '../../customers/dto/customer-response.dto';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

/** A customer referenced from a ticket. Three fields: enough to render
 *  "Orten Trading" as a link, nothing that duplicates CustomerResponseDto. */
export class CustomerRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Orten Trading' })
  name!: string;

  @ApiProperty({ required: false, nullable: true, example: 'contact@orten.example' })
  email!: string | null;
}

export class TicketCountsDto {
  @ApiProperty({ example: 4 })
  comments!: number;

  @ApiProperty({ example: 2 })
  attachments!: number;

  @ApiProperty({ example: 3 })
  history!: number;
}

export class TicketResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: () => CustomerRefDto })
  customer!: CustomerRefDto;

  @ApiProperty({ example: 'Cannot log in after password reset' })
  subject!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.TECHNICAL })
  category!: TicketCategory;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.HIGH })
  priority!: TicketPriority;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.OPEN })
  status!: TicketStatus;

  @ApiProperty({ type: () => UserRefDto, nullable: true })
  assignedAgent!: UserRefDto | null;

  @ApiProperty({ type: () => UserRefDto, nullable: true })
  createdBy!: UserRefDto | null;

  @ApiProperty({ type: () => TicketCountsDto })
  counts!: TicketCountsDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedTicketsDto {
  @ApiProperty({ type: [TicketResponseDto] })
  items!: TicketResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
```

**Create file: `apps/api/src/tickets/dto/create-ticket.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: 'Cannot log in after password reset', minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string;

  @ApiProperty({ minLength: 1, maxLength: 8000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  description!: string;

  @ApiPropertyOptional({ enum: TicketCategory, default: TicketCategory.GENERAL })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;
}
```

**Create file: `apps/api/src/tickets/dto/update-ticket.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Every field optional. `assignedAgentId: null` CLEARS the assignment —
 * distinguished from "absent" with `'assignedAgentId' in dto`, so a PATCH
 * that omits the key leaves the current assignment alone. `customerId` is
 * deliberately absent: a ticket's customer link is immutable after creation.
 * `status` is NOT here — it moves through PATCH /api/tickets/:id/status.
 */
export class UpdateTicketDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 8000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string | null;
}
```

**Create file: `apps/api/src/tickets/dto/set-ticket-status.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetTicketStatusDto {
  @ApiProperty({ enum: TicketStatus, example: TicketStatus.IN_PROGRESS })
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
```

**Create file: `apps/api/src/tickets/dto/list-tickets-query.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListTicketsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on subject or description.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
```

### 2 — `TicketsService`

**Create file: `apps/api/src/tickets/tickets.service.ts`**

```ts
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USER_REF_SELECT } from '../customers/customers.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { PaginatedTicketsDto, TicketResponseDto } from './dto/ticket-response.dto';

export const TICKET_MANAGE_PERMISSION = 'tickets:manage';

const CUSTOMER_REF_SELECT = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.CustomerSelect;

/** The ONLY projection used for ticket responses. */
const TICKET_SELECT = {
  id: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: CUSTOMER_REF_SELECT },
  assignedAgent: { select: USER_REF_SELECT },
  createdBy: { select: USER_REF_SELECT },
  _count: { select: { comments: true, attachments: true, history: true } },
} satisfies Prisma.TicketSelect;

type SelectedTicket = Prisma.TicketGetPayload<{ select: typeof TICKET_SELECT }>;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTicketsQueryDto): Promise<PaginatedTicketsDto> {
    const where: Prisma.TicketWhereInput = {};

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;
    if (query.status) where.status = query.status;
    if (query.assignedAgentId) where.assignedAgentId = query.assignedAgentId;
    if (query.customerId) where.customerId = query.customerId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: TICKET_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: items.map((item) => TicketsService.toResponse(item)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, select: TICKET_SELECT });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    return TicketsService.toResponse(ticket);
  }

  async create(dto: CreateTicketDto, caller: AuthenticatedUser): Promise<TicketResponseDto> {
    await this.assertCustomerExists(dto.customerId);
    await this.assertAgentExists(dto.assignedAgentId);

    const created = await this.prisma.ticket.create({
      data: {
        customerId: dto.customerId,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        category: dto.category,
        priority: dto.priority,
        assignedAgentId: dto.assignedAgentId,
        createdById: caller.id,
      },
      select: TICKET_SELECT,
    });

    this.logger.log({ actorId: caller.id, ticketId: created.id }, 'Ticket created');

    return TicketsService.toResponse(created);
  }

  async update(id: string, dto: UpdateTicketDto, caller: AuthenticatedUser): Promise<TicketResponseDto> {
    const current = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, category: true, priority: true, assignedAgentId: true },
    });

    if (!current) {
      throw new NotFoundException('Ticket not found.');
    }

    if ('assignedAgentId' in dto) {
      await this.assertAgentExists(dto.assignedAgentId ?? undefined);
    }

    const data: Prisma.TicketUpdateInput = {};
    const historyRows: Prisma.TicketHistoryCreateManyInput[] = [];

    if (dto.subject !== undefined) data.subject = dto.subject.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();

    if (dto.category !== undefined && dto.category !== current.category) {
      data.category = dto.category;
      historyRows.push({
        ticketId: id,
        changedById: caller.id,
        field: 'category',
        oldValue: current.category,
        newValue: dto.category,
      });
    }

    if (dto.priority !== undefined && dto.priority !== current.priority) {
      data.priority = dto.priority;
      historyRows.push({
        ticketId: id,
        changedById: caller.id,
        field: 'priority',
        oldValue: current.priority,
        newValue: dto.priority,
      });
    }

    if ('assignedAgentId' in dto && dto.assignedAgentId !== current.assignedAgentId) {
      data.assignedAgent = dto.assignedAgentId
        ? { connect: { id: dto.assignedAgentId } }
        : { disconnect: true };
      historyRows.push({
        ticketId: id,
        changedById: caller.id,
        field: 'assignedAgentId',
        oldValue: current.assignedAgentId,
        newValue: dto.assignedAgentId ?? null,
      });
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id }, data, select: TICKET_SELECT }),
      ...(historyRows.length > 0
        ? [this.prisma.ticketHistory.createMany({ data: historyRows })]
        : []),
    ]);

    this.logger.log({ actorId: caller.id, ticketId: id }, 'Ticket updated');

    return TicketsService.toResponse(updated as SelectedTicket);
  }

  async setStatus(id: string, status: TicketStatus, caller: AuthenticatedUser): Promise<TicketResponseDto> {
    const current = await this.prisma.ticket.findUnique({ where: { id }, select: { id: true, status: true } });

    if (!current) {
      throw new NotFoundException('Ticket not found.');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id }, data: { status }, select: TICKET_SELECT }),
      ...(status !== current.status
        ? [
            this.prisma.ticketHistory.createMany({
              data: [
                {
                  ticketId: id,
                  changedById: caller.id,
                  field: 'status',
                  oldValue: current.status,
                  newValue: status,
                },
              ],
            }),
          ]
        : []),
    ]);

    this.logger.log(
      { actorId: caller.id, ticketId: id, from: current.status, to: status },
      'Ticket status changed',
    );

    return TicketsService.toResponse(updated as SelectedTicket);
  }

  /** Public: reused by the comments/attachments/history services so every
   *  nested route 404s on an unknown ticket before touching a child table. */
  async assertExists(id: string): Promise<{ id: string }> {
    const exists = await this.prisma.ticket.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('Ticket not found.');
    }

    return exists;
  }

  private async assertCustomerExists(customerId: string): Promise<void> {
    const exists = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });

    if (!exists) {
      throw new BadRequestException('Unknown customerId.');
    }
  }

  private async assertAgentExists(assignedAgentId?: string): Promise<void> {
    if (!assignedAgentId) {
      return;
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: assignedAgentId },
      select: { id: true, isActive: true },
    });

    if (!agent) {
      throw new BadRequestException('Unknown assignedAgentId.');
    }

    if (!agent.isActive) {
      throw new BadRequestException('Cannot assign an inactive user.');
    }
  }

  private static toResponse(ticket: SelectedTicket): TicketResponseDto {
    return {
      id: ticket.id,
      customer: ticket.customer,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedAgent: ticket.assignedAgent,
      createdBy: ticket.createdBy,
      counts: {
        comments: ticket._count.comments,
        attachments: ticket._count.attachments,
        history: ticket._count.history,
      },
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }
}
```

`TICKET_MANAGE_PERMISSION` is exported here (not defined locally in Story 15's files) so Story 15's comment/attachment services import it the same way Story 11's services import `ARCHIVE_PERMISSION` from `customers.service.ts`.

### 3 — `TicketsController`

**Create file: `apps/api/src/tickets/tickets.controller.ts`**

| Method | Route | `@RequirePermissions` | Notes |
|---|---|---|---|
| `list` | `GET /` | `tickets:read` | `@Query() query: ListTicketsQueryDto` → `PaginatedTicketsDto` |
| `findOne` | `GET /:id` | `tickets:read` | `@Param('id', ParseUUIDPipe)`; `@ApiNotFoundResponse` |
| `create` | `POST /` | `tickets:write` | `@ApiCreatedResponse`, `@ApiBadRequestResponse` (unknown customerId/assignedAgentId); `@CurrentUser() caller` |
| `update` | `PATCH /:id` | `tickets:write` | `@ApiOkResponse`, `@ApiBadRequestResponse` |
| `setStatus` | `PATCH /:id/status` | `tickets:write` | `@ApiOkResponse` |

Follow `apps/api/src/customers/customers.controller.ts` line-for-line for decorator shape (`@ApiTags('tickets')`, `@ApiBearerAuth()`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse` at the class level; `@Controller('tickets')`). There is no `@Delete` route. `setStatus` delegates `this.ticketsService.setStatus(id, dto.status, caller)`.

### 4 — Module wiring

**Create file: `apps/api/src/tickets/tickets.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [AuthModule, CustomersModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
```

`CustomersModule` is imported (not just `CustomersService` injected) because `CustomersModule` already `exports: [CustomersService]` — however this story's `TicketsService` does **not** call `CustomersService` (its `assertCustomerExists` queries `prisma.customer` directly, matching how `assertAgentExists` queries `prisma.user` directly rather than going through `UsersService`). The `CustomersModule` import is here so Story 15's `TicketAttachmentsService` and friends, once they exist, have `TicketsModule`'s own exports available without a second import chain — re-verify this is still needed once Story 15 is written; if not, drop `CustomersModule` from `imports`.

**File: `apps/api/src/app.module.ts`** — add the import at line 12 (after `CustomersModule`'s import) and the module at line 58 (after `CustomersModule` in the `imports` array):

```ts
import { TicketsModule } from './tickets/tickets.module';
```
```ts
    CustomersModule,
    TicketsModule,
```

**File: `apps/api/src/main.ts`** — add one tag to the `.addTag(...)` chain (after line 48, `'customers'`):

```ts
    .addTag('tickets', 'Customer support tickets')
```

## Edge Cases & Failure Modes

- **`customerId` referencing an archived-status customer**: allowed. Creating a ticket for a customer in any `CustomerStatus` (including a hypothetical restored/archived state) is not restricted — the intake does not ask for this gate, unlike work item 3's block on editing an `ARCHIVED` customer.
- **`assignedAgentId` referencing an inactive user** → `400 Cannot assign an inactive user.` from `assertAgentExists`, identical wording pattern to `CustomersService.assertAgentExists`.
- **Setting `status` to its current value** → `200`, ticket row updated (no-op on the same value), **no** `TicketHistory` row written — the `status !== current.status` guard in `setStatus()` skips the `createMany`.
- **`PATCH /tickets/:id` with an empty body `{}`** → `200`, no fields change, no history rows (every branch in `update()` is gated on the field being present in `dto` and, for category/priority/assignedAgentId, different from the current value).
- **`PATCH /tickets/:id` re-sending the same `category`** → `200`, `data.category` is not set (falls through the `!== current.category` check), no history row — confirms rule 4 in Product rules.
- **Concurrent `PATCH` on the same ticket from two callers** → last write wins, same as customers; no optimistic-concurrency token exists.
- **`page=9999` on an empty result set** → `200` with `items: []`, never `404` — matches `CustomersService.list`.
- **Unknown query parameter on `GET /tickets`** → `400` under the global `ValidationPipe`'s `forbidNonWhitelisted: true`.
- **`search` containing `%`/`_`** → parameterized by Prisma, not a wildcard-injection vector — same note as customer search.
- **Race between `assertExists`/`findUnique` and the subsequent `update()`** (ticket deleted between the two — not possible today since no delete route exists, but the code does not special-case it) → an unmapped Prisma `P2025` surfaces as an unhandled `500`, exactly like the equivalent customer-update race documented in Story 10. Acceptable: no route exists that could cause it.
- **`TicketHistory.oldValue`/`newValue` for `assignedAgentId`** store the raw UUID or `null`, never a resolved user name — Story 16's History tab is responsible for rendering it (see [00-overview.md](00-overview.md)).

## Test Plan

1. **Unit — `apps/api/src/tickets/tickets.service.spec.ts`.** Modelled on `apps/api/src/customers/customers.service.spec.ts` (hand-rolled Prisma mock via `jest.fn()`, a `containing()`/`notContaining()` matcher helper, a `buildCaller()` factory, a `baseTicketRow` fixture). Cover: `list()` where-clause assembly for each filter key and for `search` (both `subject` and `description` branches of the `OR`); `create()` calls `assertCustomerExists` and rejects an unknown `customerId` with `BadRequestException`; `create()` rejects an inactive `assignedAgentId`; `update()` writes a `TicketHistory` row only when `category`/`priority`/`assignedAgentId` actually changes, and writes **no** row for an unchanged resend of the same value; `update()`'s `assignedAgentId` null-vs-absent behavior (mock `prisma.ticket.update` call args to assert `connect`/`disconnect`); `setStatus()` writes exactly one history row on a real transition and zero on a same-value call; `toResponse()` field mapping including `counts`.
2. **Integration — new file `apps/api/test/tickets.e2e-spec.ts`.** Bootstrap copied from `apps/api/test/customers.e2e-spec.ts`'s setup (sign in as the seeded administrator, create fixture users/customers prefixed `E2E `). Cover: `401` with no token; `200` list shape with `items`/`meta`; `201` create with only required fields defaults `category: GENERAL`/`priority: MEDIUM`/`status: OPEN`; `400` on an unknown `customerId`; `400` on an unknown or inactive `assignedAgentId`; `200`/`404` on `GET /tickets/:id`; `PATCH` clearing `assignedAgentId` via explicit `null` versus an absent key leaving it untouched; `search`/`category`/`priority`/`status`/`assignedAgentId`/`customerId` filter assertions; unknown query key → `400`; `PATCH /:id/status` transitions and confirms a `TicketHistory` row exists afterward (via a follow-up call once Story 15's `GET .../history` route exists — until then, assert indirectly via `counts.history` on the ticket response); a `support-agent`-role caller (has `tickets:write` but not `tickets:manage`) can still update/status-change freely — confirms rule 2 (no elevated-permission gate on status); a zero-permission `customer`-role caller gets `403` on every route. Clean up fixture rows with `prisma.ticket.deleteMany({ where: { subject: { startsWith: 'E2E ' } } })`.
3. **No frontend test** — Story 16 owns the frontend.

## Verification Steps

1. **Build:** `npm run build --workspace @crm/api`.
2. **Typecheck/lint:** `npm run typecheck --workspace @crm/api`, `npm run lint --workspace @crm/api`.
3. **Unit tests:** `npm run test --workspace @crm/api -- tickets.service`.
4. **E2E tests:** `npm run test:e2e --workspace @crm/api`.
5. **Grep check:** confirm every `@RequirePermissions(...)` string literal in `tickets.controller.ts` exists in `apps/api/prisma/seed.ts`'s `permissions` array (`grep -r "RequirePermissions" apps/api/src/tickets/`).
6. **Swagger manual check:** start the API (`npm run dev:api`), open `/api/docs`, confirm a `tickets` tag with 5 operations, the `TicketCategory`/`TicketPriority`/`TicketStatus` enums render their full value sets, and `PATCH /tickets/:id/status` documents no archive-style restriction.
7. **Manual create/read/search/filter/status check** against a running API with `curl` or the Swagger UI, using the seeded administrator's bearer token: create a ticket against a fixture customer, list with each filter individually, `PATCH` category/priority/assignedAgentId, `PATCH .../status`, and confirm `counts.history` increments only on real changes.
8. **Regression check:** confirm `apps/api/test/customers.e2e-spec.ts` and `apps/api/test/customer-children.e2e-spec.ts` still pass unmodified — this story must not touch any file under `apps/api/src/customers/`.
9. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.
10. **`npx prisma migrate status`** from `apps/api` confirms no pending migrations (this story creates none).

## Done Criteria

- [ ] `TicketsController` exposes exactly the five routes in the table above, no `DELETE`.
- [ ] `TicketsService.update()` and `setStatus()` write `TicketHistory` rows only on real changes.
- [ ] `TicketsService.assertExists` is public and exported for Story 15 to reuse.
- [ ] `TICKET_MANAGE_PERMISSION` is exported from `tickets.service.ts` for Story 15 to import.
- [ ] `TicketsModule` is registered in `app.module.ts`; `tickets` tag is in `main.ts`'s Swagger config.
- [ ] Unit and e2e tests pass; no file under `apps/api/src/customers/` was modified.
- [ ] Full-repo typecheck/lint/test/build pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 15.**
