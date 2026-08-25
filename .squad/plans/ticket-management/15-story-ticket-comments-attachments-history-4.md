# Story 15 — Ticket comments, attachments, and history (Story: 4)

## Prerequisites

- [Story 14 completed](14-story-ticket-api-4.md): `TicketsService.assertExists` (public) and `TICKET_MANAGE_PERMISSION` (exported) must exist, and `TicketsModule` must already export `TicketsService`.
- This story **modifies a Story-11 file**: `apps/api/src/customers/attachment-storage.service.ts` moves to `apps/api/src/common/attachment-storage.service.ts` and its `save()` signature gains a `folder` parameter. Coordinate with anyone touching `apps/api/src/customers/attachments.service.ts` or `attachment-storage.service.spec.ts` concurrently.

## Story Goal

1. Three nested sub-resources under `/api/tickets/:ticketId/`: `comments` (full CRUD except delete-by-non-author), `attachments` (upload/list/download/delete), `history` (list only, no write route).
2. Generalise `AttachmentStorageService` so ticket attachments and customer attachments share one implementation, distinguished by a `folder: 'customers' | 'tickets'` parameter.
3. Wire all three new controllers/services, plus the relocated `AttachmentStorageService`, into `TicketsModule`.

**Not in scope:** any frontend change (Story 16). No `PATCH`/`POST`/`DELETE` route on `TicketHistoryController` — history rows are written exclusively by `TicketsService` (Story 14), never by a client of this story's routes.

## Context — Read These Files First

1. [`.squad/plans/customer-management/11-story-customer-notes-attachments-interactions-3.md`](../customer-management/11-story-customer-notes-attachments-interactions-3.md) — the direct template for this story's shape. Its task 2 (`AttachmentStorageService`), task 3 (notes), task 4 (interactions), task 5 (attachments), and task 6 (module wiring) map onto this story's tasks 1 (storage generalisation), 2 (comments), 3 (attachments), 4 (history), 5 (wiring) respectively. Its Edge Cases and Test Plan sections are the template for this story's own.
2. [`apps/api/src/customers/attachment-storage.service.ts`](../../../apps/api/src/customers/attachment-storage.service.ts) — full file (99 lines), **the file this story moves and edits**. Read every method: `save()` (lines 44–64, builds `storageKey` as `` `customers/${customerId}/${randomUUID()}${extension}` `` at line 53 — this literal `'customers'` prefix becomes the new `folder` parameter), `createStream()` (66–68), `remove()` (74–82), the private `resolveKey()` containment check (89–97), and the `ALLOWED_MIME_TYPES` whitelist (13–25, unchanged, moves with the file).
3. [`apps/api/src/customers/attachments.service.ts`](../../../apps/api/src/customers/attachments.service.ts) — full file (198 lines). This is the **only existing call site** you must update: line 14's import (`from './attachment-storage.service'` → `from '../common/attachment-storage.service'`) and line 91's call (`this.storage.save(customerId, file.buffer, file.mimetype)` → `this.storage.save('customers', customerId, file.buffer, file.mimetype)`). Nothing else in this file changes — it is the template for the new `TicketAttachmentsService`, whose `create()` (lines 62–119), `remove()` (121–153), and `sanitiseFileName()` (178–183) are copied field-for-field with `customer` → `ticket` renames.
4. [`apps/api/src/customers/attachments.controller.ts`](../../../apps/api/src/customers/attachments.controller.ts) — full file (131 lines). The upload route's `FileInterceptor` config (lines 57–61, `memoryStorage()`, hard-coded `10 * 1024 * 1024` byte limit), the download route's header-setting block (lines 101–109, `Content-Disposition`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`) and its `@Res({ passthrough: true })` parameter (line 97), and the delete route (114–129) are copied verbatim into `TicketAttachmentsController` with `customer` → `ticket` renames.
5. [`apps/api/src/customers/notes.controller.ts`](../../../apps/api/src/customers/notes.controller.ts) and [`notes.service.ts`](../../../apps/api/src/customers/notes.service.ts) — both full files (90 and 118 lines). The author-only edit check (`notes.service.ts` lines 66–68) and the author-or-elevated-permission delete check (lines 84–88, using `ARCHIVE_PERMISSION` imported from `customers.service.ts`) are the direct template for `TicketCommentsService`, substituting `ARCHIVE_PERMISSION` → `TICKET_MANAGE_PERMISSION` (imported from `../tickets/tickets.service`, exported there per Story 14 task 2). The `assertScoped` private helper (notes.service.ts lines 95–106, `findFirst({ where: { id, ticketId } })`) is the pattern for scoping every child lookup to its parent.
6. [`apps/api/src/customers/dto/note.dto.ts`](../../../apps/api/src/customers/dto/note.dto.ts), [`attachment.dto.ts`](../../../apps/api/src/customers/dto/attachment.dto.ts) — both full files (36 and 37 lines). Direct templates for `comment.dto.ts` and `ticket-attachment.dto.ts` (this story's file names) — same field shapes, `body`/`fileName`/`mimeType`/`sizeBytes`/`checksumSha256`/`uploadedBy`/`createdAt`.
7. [`apps/api/src/customers/customers.module.ts`](../../../apps/api/src/customers/customers.module.ts) — full file (31 lines). Confirms `AttachmentStorageService` is currently imported from `'./attachment-storage.service'` and listed in `providers` — this story changes that import path and, per Product rule 8 below, `TicketsModule` lists the same class (imported from its new location) in its own `providers` array.
8. [`apps/api/.env.example`](../../../apps/api/.env.example) lines 35–42 and [`apps/api/src/config/env.validation.ts`](../../../apps/api/src/config/env.validation.ts) lines 72–82 — `UPLOAD_DIR` and `MAX_UPLOAD_BYTES` are reused unchanged. No new environment variable is added by this story.
9. Grep for `MAX_ATTACHMENTS_PER_CUSTOMER` in `apps/api/src/customers/attachments.service.ts` (line 18) — this story defines an equivalent `MAX_ATTACHMENTS_PER_TICKET = 20` constant in `TicketAttachmentsService`.

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | Reading any child (comments/attachments/history) needs only `tickets:read` — there is no `ticket-comments:read` or `history:read`. | Matches the "one read key" decision from Story 14 and work item 3. |
| 2 | Comment edit is author-only; comment/attachment delete is author (or uploader) OR a `tickets:manage` holder. | Direct port of the `CustomerNote`/`CustomerAttachment` rule, substituting `tickets:manage` for `customers:archive`. |
| 3 | There is no comment "interaction" equivalent — comments are edit-and-delete, unlike `CustomerInteraction`'s create-and-delete-only. | Ticket comments behave like `CustomerNote`, not `CustomerInteraction` — the intake calls them "Comments," a conversational thread, which supports correction via edit. |
| 4 | `TicketHistory` has **no** `POST`/`PATCH`/`DELETE` route. `TicketHistoryController` is `GET`-only. | History rows are a side effect of `TicketsService.update()`/`setStatus()` (Story 14), never a direct client action — see [00-overview.md](00-overview.md). |
| 5 | Attachment mime whitelist, 10 MB/file, 20 files/ticket — identical numbers to the customer feature. | No stated reason for ticket attachments to have different limits; reusing the same `ALLOWED_MIME_TYPES` and size ceiling avoids an arbitrary second set of numbers. |
| 6 | `AttachmentStorageService.save()` takes an explicit `folder: 'customers' \| 'tickets'` as its first parameter. Storage keys become `` `${folder}/${scopeId}/${uuid}${ext}` ``. | For `folder === 'customers'` this produces byte-identical keys to the pre-Story-15 format (`customers/<customerId>/<uuid><ext>`) — **no migration or backfill of existing customer attachment rows is needed.** |
| 7 | `AttachmentStorageService` is relocated to `apps/api/src/common/` and registered as a provider in **both** `CustomersModule` and `TicketsModule`. | It is stateless (its only per-instance state, `baseDir`, is resolved identically from `UPLOAD_DIR` in both modules), so two module-scoped instances are equivalent to one shared instance — no need for a dedicated `CommonModule` just to share it. |
| 8 | Ticket attachment download headers are identical to customer attachment download: always `Content-Disposition: attachment`, never inline, `X-Content-Type-Options: nosniff`. | Same stored-XSS reasoning as work item 3 — the SPA and API share an origin. |

## Backend Tasks

### 1 — Generalise `AttachmentStorageService`

**Move file: `apps/api/src/customers/attachment-storage.service.ts` → `apps/api/src/common/attachment-storage.service.ts`**

Change the `save()` method signature and body (everything else in the file — `ALLOWED_MIME_TYPES`, `StoredFile`, the constructor, `createStream()`, `remove()`, `resolveKey()` — is unchanged, only relocated):

```ts
async save(
  folder: 'customers' | 'tickets',
  scopeId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredFile> {
  const extension = ALLOWED_MIME_TYPES[mimeType];

  if (!extension) {
    throw new InternalServerErrorException('Unsupported attachment type.');
  }

  const storageKey = `${folder}/${scopeId}/${randomUUID()}${extension}`;
  const absolute = this.resolveKey(storageKey);

  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);

  return {
    storageKey,
    checksumSha256: createHash('sha256').update(buffer).digest('hex'),
    sizeBytes: buffer.byteLength,
  };
}
```

**Move file: `apps/api/src/customers/attachment-storage.service.spec.ts` → `apps/api/src/common/attachment-storage.service.spec.ts`**, updating every `.save(...)` call in its tests to pass `'customers'` as the new first argument, and add at least one test asserting `.save('tickets', ticketId, ...)` produces a `storageKey` starting with `tickets/`.

**File: `apps/api/src/customers/attachments.service.ts`** — update the import at line 14:

```ts
import { ALLOWED_MIME_TYPES, AttachmentStorageService } from '../common/attachment-storage.service';
```

and the call at line 91:

```ts
const stored = await this.storage.save('customers', customerId, file.buffer, file.mimetype);
```

No other line in this file changes.

**File: `apps/api/src/customers/customers.module.ts`** — update the import:

```ts
import { AttachmentStorageService } from '../common/attachment-storage.service';
```

`AttachmentStorageService` stays in this module's `providers` array unchanged — only the import path moves.

### 2 — Comments

**Create file: `apps/api/src/tickets/dto/comment.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { UserRefDto } from '../../customers/dto/customer-response.dto';

export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class UpdateCommentDto extends CreateCommentDto {}

export class CommentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({ type: () => UserRefDto })
  author!: UserRefDto;

  @ApiProperty()
  body!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
```

**Create file: `apps/api/src/tickets/ticket-comments.service.ts`** — port `apps/api/src/customers/notes.service.ts` field-for-field: `TICKET_COMMENT_SELECT` (mirrors `NOTE_SELECT`, embedding `author: { select: USER_REF_SELECT }` imported from `../customers/customers.service`), constructor injecting `PrismaService` and `TicketsService` (in place of `CustomersService`), `list(ticketId)` calling `this.ticketsService.assertExists(ticketId)` first, `create()`, `update()` (author-only check: `if (comment.authorId !== caller.id) throw new ForbiddenException('Only the author can edit a comment.')`), `remove()` (author-or-manage check: `if (comment.authorId !== caller.id && !caller.permissions.includes(TICKET_MANAGE_PERMISSION))`, importing `TICKET_MANAGE_PERMISSION` from `../tickets/tickets.service`), a private `assertScoped(ticketId, id)` using `findFirst({ where: { id, ticketId } })`, and a static `toResponse()`.

**Create file: `apps/api/src/tickets/ticket-comments.controller.ts`** — port `apps/api/src/customers/notes.controller.ts`: `@Controller('tickets/:ticketId/comments')`, `@ApiTags('ticket-comments')`, routes:

| Method | Route | Permission |
|---|---|---|
| `list` | `GET /` | `tickets:read` |
| `create` | `POST /` | `ticket-comments:write` |
| `update` | `PATCH /:id` | `ticket-comments:write` |
| `remove` | `DELETE /:id` (`@HttpCode(HttpStatus.NO_CONTENT)`) | `ticket-comments:write` |

### 3 — Attachments

**Create file: `apps/api/src/tickets/dto/ticket-attachment.dto.ts`** — port `apps/api/src/customers/dto/attachment.dto.ts` field-for-field (`id`, `ticketId`, `fileName`, `mimeType`, `sizeBytes`, `checksumSha256`, `uploadedBy: UserRefDto`, `createdAt` — `storageKey` deliberately absent, same comment as the customer version). No create/update DTO — the upload body is `multipart/form-data` via `@UploadedFile()`.

**Create file: `apps/api/src/tickets/ticket-attachments.service.ts`** — port `apps/api/src/customers/attachments.service.ts` field-for-field:

```ts
export const MAX_ATTACHMENTS_PER_TICKET = 20;
```

Constructor injects `PrismaService`, `TicketsService` (in place of `CustomersService`), `AttachmentStorageService` (imported from `../common/attachment-storage.service`), and `ConfigService` for `MAX_UPLOAD_BYTES` — identical to `AttachmentsService`'s constructor. `create()` follows the exact same order as `AttachmentsService.create()` (lines 62–119 of the customer file): `assertExists` → file-present check → mime whitelist check → size check → per-ticket count check against `MAX_ATTACHMENTS_PER_TICKET` → `this.storage.save('tickets', ticketId, file.buffer, file.mimetype)` → `prisma.ticketAttachment.create(...)` in a try/catch that removes the just-written file on insert failure. `remove()` follows the same row-first-file-second order with the author-or-`TICKET_MANAGE_PERMISSION` check. `getForDownload()` and `createStream()` are ported unchanged in shape. `sanitiseFileName()` is copied verbatim (identical regex, identical 200-char cap).

**Create file: `apps/api/src/tickets/ticket-attachments.controller.ts`** — port `apps/api/src/customers/attachments.controller.ts` field-for-field, including the exact `FileInterceptor` config (`memoryStorage()`, `limits: { fileSize: 10 * 1024 * 1024, files: 1 }`) and the exact download header block:

| Method | Route | Permission |
|---|---|---|
| `list` | `GET /` | `tickets:read` |
| `create` | `POST /` (multipart) | `ticket-attachments:write` |
| `download` | `GET /:id/content` | `tickets:read` |
| `remove` | `DELETE /:id` | `ticket-attachments:write` |

### 4 — History (read-only)

**Create file: `apps/api/src/tickets/dto/ticket-history.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { UserRefDto } from '../../customers/dto/customer-response.dto';

export class TicketHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({ example: 'status' })
  field!: string;

  @ApiProperty({ required: false, nullable: true })
  oldValue!: string | null;

  @ApiProperty({ required: false, nullable: true })
  newValue!: string | null;

  @ApiProperty({ type: () => UserRefDto })
  changedBy!: UserRefDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
```

**Create file: `apps/api/src/tickets/ticket-history.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USER_REF_SELECT } from '../customers/customers.service';
import { TicketsService } from './tickets.service';
import { TicketHistoryResponseDto } from './dto/ticket-history.dto';

const HISTORY_SELECT = {
  id: true,
  ticketId: true,
  field: true,
  oldValue: true,
  newValue: true,
  createdAt: true,
  changedBy: { select: USER_REF_SELECT },
} satisfies Prisma.TicketHistorySelect;

type SelectedHistory = Prisma.TicketHistoryGetPayload<{ select: typeof HISTORY_SELECT }>;

@Injectable()
export class TicketHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  async list(ticketId: string): Promise<TicketHistoryResponseDto[]> {
    await this.ticketsService.assertExists(ticketId);

    const rows = await this.prisma.ticketHistory.findMany({
      where: { ticketId },
      select: HISTORY_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => TicketHistoryService.toResponse(row));
  }

  private static toResponse(row: SelectedHistory): TicketHistoryResponseDto {
    return {
      id: row.id,
      ticketId: row.ticketId,
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      changedBy: row.changedBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
```

**Create file: `apps/api/src/tickets/ticket-history.controller.ts`**

```ts
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { TicketHistoryResponseDto } from './dto/ticket-history.dto';
import { TicketHistoryService } from './ticket-history.service';

@ApiTags('ticket-history')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tickets/:ticketId/history')
export class TicketHistoryController {
  constructor(private readonly ticketHistoryService: TicketHistoryService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: "A ticket's audit trail, newest change first" })
  @ApiOkResponse({ type: [TicketHistoryResponseDto] })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string): Promise<TicketHistoryResponseDto[]> {
    return this.ticketHistoryService.list(ticketId);
  }
}
```

No `POST`/`PATCH`/`DELETE` handler exists on this controller — confirmed absent by design (Product rule 4).

### 5 — Module wiring

**File: `apps/api/src/tickets/tickets.module.ts`** (created in Story 14) — replace its contents:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { AttachmentStorageService } from '../common/attachment-storage.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketCommentsController } from './ticket-comments.controller';
import { TicketCommentsService } from './ticket-comments.service';
import { TicketAttachmentsController } from './ticket-attachments.controller';
import { TicketAttachmentsService } from './ticket-attachments.service';
import { TicketHistoryController } from './ticket-history.controller';
import { TicketHistoryService } from './ticket-history.service';

@Module({
  imports: [AuthModule, CustomersModule],
  controllers: [
    TicketsController,
    TicketCommentsController,
    TicketAttachmentsController,
    TicketHistoryController,
  ],
  providers: [
    TicketsService,
    TicketCommentsService,
    TicketAttachmentsService,
    TicketHistoryService,
    AttachmentStorageService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
```

**File: `apps/api/src/main.ts`** — extend the `.addTag(...)` chain (after the `'tickets'` tag Story 14 added):

```ts
    .addTag('ticket-comments', 'Comments on a ticket')
    .addTag('ticket-attachments', 'Files attached to a ticket')
    .addTag('ticket-history', "A ticket's audit trail of tracked field changes")
```

## Edge Cases & Failure Modes

- **Unknown `ticketId` on any nested route** → `404` via `assertExists` as the first statement of every service method — identical to the customer feature's rule.
- **A comment/attachment/history id from a different ticket** → `404`, never `403` — `findFirst({ where: { id, ticketId } })` returns nothing, same as `assertScoped` in the customer feature.
- **Editing someone else's comment** → `403 Only the author can edit a comment.` No exception for `tickets:manage` holders — same as work item 3's note rule: an elevated permission authorises deletion, never a rewrite under someone else's byline.
- **Missing file part on ticket attachment upload** → `@UploadedFile()` yields `undefined`; the service throws `400` (the `ValidationPipe` cannot validate a multipart body).
- **File over 10 MB** → multer's `limits.fileSize` aborts first with `413`; the service's own size check is unreachable in the default configuration, kept as a defensive guard exactly as documented for the customer feature.
- **21st attachment on a ticket** → `400` from the `MAX_ATTACHMENTS_PER_TICKET` count check.
- **Disguised file type** (`.exe` renamed `.pdf` with a forged `Content-Type`) → accepted; no magic-byte inspection, same explicitly out-of-scope decision as work item 3.
- **`UPLOAD_DIR` unwritable or disk full during a ticket attachment upload** → `500`, no `ticket_attachments` row created (write-bytes-first ordering, same as customer attachments).
- **Insert failure after the file is written** → the `catch` block removes the just-written file before rethrowing, same compensating-action pattern as `AttachmentsService.create()`.
- **Deleting a ticket** is not a route that exists (Story 14 has no `DELETE /tickets/:id`), so the `onDelete: Cascade` on `TicketComment`/`TicketAttachment`/`TicketHistory` is defensive, not load-bearing today.
- **Two tickets uploading a file with the same original filename** → no conflict; `storageKey` is always `randomUUID()`-derived, `fileName` collisions are cosmetic only (display-only field).
- **`GET /tickets/:ticketId/history` on a brand-new ticket with no field changes yet** → `200` with `[]`, not `404` — an empty audit trail is a valid state.
- **A caller with `tickets:read` but neither `ticket-comments:write` nor `ticket-attachments:write`** can view but not add comments/attachments — matches the read/write separation used throughout work item 3.
- **The relocated `AttachmentStorageService`'s customer call site** (`attachments.service.ts` line 91) must be updated in the same commit as the move — a stale import path (`'./attachment-storage.service'`, now deleted) is a compile-time failure caught immediately by `npm run typecheck --workspace @crm/api`, not a silent bug.

## Test Plan

1. **Unit — `apps/api/src/common/attachment-storage.service.spec.ts`** (relocated from `apps/api/src/customers/`). Update every existing assertion to pass `'customers'` as the new first `.save()` argument; add a new case asserting `.save('tickets', ticketId, buffer, mimeType)` produces a `storageKey` starting with `tickets/${ticketId}/`; keep the existing path-traversal test (a crafted `storageKey` like `../../../etc/passwd` must throw via `resolveKey`'s containment check) unchanged since it does not depend on `folder`.
2. **Unit — `apps/api/src/customers/attachments.service.spec.ts`**. No new test cases needed, but update the mock's expected `.save(...)` call args to include the new `'customers'` first argument, or the existing assertions will fail after this story's edit.
3. **Unit — `apps/api/src/tickets/ticket-comments.service.spec.ts`**. Modelled on `apps/api/src/customers/notes.service.spec.ts` (same `buildCaller()`/`baseCommentRow` fixture style). Cover: author-only edit rejection; author-or-`tickets:manage` delete; `tickets:manage`-holder deleting someone else's comment succeeds; scoped lookup 404s across tickets.
4. **Unit — `apps/api/src/tickets/ticket-attachments.service.spec.ts`**. Modelled on `apps/api/src/customers/attachments.service.spec.ts`, asserting call order via `mock.invocationCallOrder` for the write-bytes-then-insert-then-compensate-on-failure sequence, plus the `MAX_ATTACHMENTS_PER_TICKET` boundary.
5. **Unit — `apps/api/src/tickets/ticket-history.service.spec.ts`**. Small: `list()` calls `assertExists` first, maps rows via `toResponse`, orders `createdAt desc`. Confirm the service has no `create`/`update`/`remove` method (assert `(service as any).create` is `undefined`, mirroring the `interactions.service.spec.ts` pattern that asserts no `update` method exists).
6. **Integration — new file `apps/api/test/ticket-children.e2e-spec.ts`**, modelled on `apps/api/test/customer-children.e2e-spec.ts`. Cover: author-`403` on comment edit; unsupported-mime-`400` on upload; oversized-file-`413`; missing-file-`400`; download response headers (`Content-Disposition`, `nosniff`, `Cache-Control`); delete-then-`404`; a `support-agent` (has `ticket-comments:write`/`ticket-attachments:write` but not `tickets:manage`) blocked from deleting another agent's comment/attachment, then a `crm-manager` (has `tickets:manage`) succeeding at the same delete; `GET .../history` returns rows after a `PATCH /tickets/:id` that changes `priority` and after a `PATCH /tickets/:id/status`, with `field`/`oldValue`/`newValue` matching the change; `POST`/`PATCH`/`DELETE` on `/tickets/:id/history` all `404` (no such route).
7. **No frontend test** — Story 16 owns the frontend.

## Verification Steps

1. **Build:** `npm run build --workspace @crm/api`.
2. **Typecheck/lint:** `npm run typecheck --workspace @crm/api`, `npm run lint --workspace @crm/api` — this is where a stale import from the moved `attachment-storage.service.ts` would surface first.
3. **Unit tests:** `npm run test --workspace @crm/api`.
4. **E2E tests:** `npm run test:e2e --workspace @crm/api`.
5. **Regression — customer attachments still work:** run `apps/api/test/customer-children.e2e-spec.ts` specifically and confirm it still passes unmodified after the `AttachmentStorageService` relocation; manually upload a customer attachment and confirm the resulting file lands under `<UPLOAD_DIR>/customers/<customerId>/…` (unchanged path shape).
6. **Manual smoke test:** start the API, create a fixture ticket, add a comment, upload an attachment, confirm it lands under `<UPLOAD_DIR>/tickets/<ticketId>/…`, download it and confirm headers, delete it, change the ticket's priority and status via Story 14's routes, then `GET /tickets/:id/history` and confirm two rows appear with correct `oldValue`/`newValue`.
7. **Swagger manual check:** confirm `ticket-comments`, `ticket-attachments`, `ticket-history` tags appear with the expected operation counts (4, 4, 1 respectively), and that `ticket-history`'s single operation is `GET`.
8. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.
9. **`npx prisma migrate status`** from `apps/api` confirms no pending migrations (this story creates none).

## Done Criteria

- [ ] `AttachmentStorageService` lives at `apps/api/src/common/attachment-storage.service.ts`, takes a `folder` parameter, and both `CustomersModule` and `TicketsModule` register it as a provider.
- [ ] `apps/api/src/customers/attachments.service.ts`'s single call site is updated to pass `'customers'`; no other customer-feature file changed.
- [ ] `TicketCommentsController`/`Service`, `TicketAttachmentsController`/`Service`, `TicketHistoryController`/`Service` exist with the routes specified above.
- [ ] `TicketHistoryController` has exactly one route (`GET`), no write routes.
- [ ] `tickets:manage` gates cross-author comment/attachment deletion; `ticket-comments:write`/`ticket-attachments:write` gate everything else.
- [ ] Existing customer-feature e2e tests pass unmodified after the storage-service relocation.
- [ ] Unit and e2e tests for the new sub-resources pass.
- [ ] Full-repo typecheck/lint/test/build pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 16.**
