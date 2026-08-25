# Story 11 — Customer notes, attachments, and interaction history (Story: 3)

## Prerequisites

- [Story 09 completed](09-story-customer-data-model-3.md): the `CustomerNote`, `CustomerAttachment`, and `CustomerInteraction` tables, the `InteractionChannel` / `InteractionDirection` enums, and the seeded keys `notes:write`, `attachments:write`, and `interactions:write`.
- [Story 10 completed](10-story-customer-api-3.md): `CustomersModule`, `CustomersService` (exported), `CUSTOMER_SELECT`, `UserRefDto`, and the `customers` Swagger tag. Every route here is nested under a customer that Story 10's service validates.
- [Story 07 completed](../authentication-and-user-management/07-story-rbac-user-management-api-2.md): `PermissionsGuard` and `@CurrentUser()`.
- **PostgreSQL must be running**, migrated, and seeded.
- **This story writes files to disk.** It adds one environment variable and one gitignore entry; both must land before the first upload is attempted.
- This story adds **no migration**. Story 09 already created all three tables.

---

## Story Goal

Give a customer profile its history: notes an agent writes, files an agent uploads, and interactions an agent logs — each as a nested collection under the customer, each behind its own permission key.

User-visible outcomes:

1. `GET/POST /api/customers/:customerId/notes` and `PATCH/DELETE …/notes/:id` — notes, editable and deletable **only by their author**.
2. `GET/POST /api/customers/:customerId/attachments`, `GET …/attachments/:id/content`, `DELETE …/attachments/:id` — files up to 10 MB from a fixed type whitelist, stored on disk under a name this application generates.
3. `GET/POST /api/customers/:customerId/interactions` and `DELETE …/interactions/:id` — the timeline of calls, emails, chats, and meetings, newest first by when they **occurred**.
4. Every route 404s on an unknown customer before doing anything else, and a child id belonging to another customer is a `404`, never someone else's row.

**Not in scope:** any frontend file — Story 12. Virus scanning, thumbnailing, and image resizing. Object storage (S3 and friends). A `Ticket` entity — the interaction timeline is the history this work item can honestly deliver; see the overview. Editing an interaction after the fact: it is a log, so it is create-and-delete only.

---

## Product rules (from story)

| Topic | **Decision** | Why |
|---|---|---|
| Reading children | `customers:read` alone. There is no `notes:read` | A caller trusted with the profile is trusted with its history. Four read keys would quadruple the catalogue for a distinction nobody asked for. |
| Editing a note | Only the **author**, and only their own note. `notes:write` gates creation | A note is a signed statement about a customer. Letting a second agent rewrite it under the first agent's name is worse than leaving a stale note. |
| Deleting a note | The author, **or** a caller holding `customers:archive` | Somebody has to be able to remove a note posted to the wrong customer after its author left. `customers:archive` is already the "senior" key and needs no new permission. |
| Interactions | Create and delete, **no edit** | It records what happened. Correcting it means deleting and re-logging, which leaves the intent visible instead of silently rewriting history. |
| `occurredAt` | Supplied by the caller; must not be more than **5 minutes** in the future | Back-dating a call logged after the fact is the normal case. Forward-dating is either a clock skew or a mistake; 5 minutes absorbs the former. |
| Attachment bytes | The **filesystem**, under `UPLOAD_DIR`, keyed `customers/<customerId>/<uuid><ext>` | Story 09 recorded why not `bytea`. Object storage needs credentials and a deployment story neither of which exists yet; the storage service is a single seam to swap later. |
| Stored filename | **Generated**: a uuid plus an extension derived from the *whitelisted mime type*, never from the client string | The client filename is attacker-controlled. `../../.env` and `evil.svg` both become `9f3c….pdf` or are rejected outright. The original is kept in `fileName` for display only. |
| Type whitelist | A fixed allow-list of eleven mime types. Anything else is `400` | A deny-list is a losing game. SVG is **excluded** on purpose: it is executable markup in a browser. |
| Serving a file | Always `Content-Disposition: attachment`, always `X-Content-Type-Options: nosniff` | The API and the SPA share an origin through the Vite proxy. An inline-rendered HTML or SVG attachment would be stored XSS against the CRM itself. |
| Size and count limits | 10 MB per file, **20** files per customer | Bounded disk per customer without a quota system. Both are configurable in one constant each. |
| Duplicate uploads | Allowed. The SHA-256 checksum is **recorded, not enforced** | Two agents attaching the same signed PDF to one customer is a normal event; the checksum exists so a human can spot it, not so the API can refuse it. |
| Deleting an attachment | Removes the row, then best-effort removes the file | Reversed, a failed delete would leave a row pointing at nothing — a broken download. An orphaned file is invisible and harmless. |

---

## Context — Read These Files First

1. [Story 10's plan](10-story-customer-api-3.md), the **CustomersService** task — this story's services follow the same skeleton (a `satisfies Prisma.…Select` constant, a `SelectedX` payload type, public methods, private assertions, a static `toResponse`).
2. `apps/api/src/customers/customers.service.ts` (as Story 10 left it) — the `USER_REF_SELECT` constant and `assertExists`. **Reuse them**; a second projection of a user reference is how two shapes drift apart.
3. `apps/api/src/users/users.controller.ts` — **lines 39–46** for the controller decorator stack; **lines 129–143** for a route that returns `204` via `@HttpCode(HttpStatus.NO_CONTENT)` and `@ApiNoContentResponse`. Every `DELETE` here does the same.
4. `apps/api/src/org/org.controller.ts` — all 95 lines. **Two controllers in one file**, each with its own `@ApiTags` and `@Controller` prefix. That is the precedent for grouping this story's three controllers, though this plan keeps them in three files for size.
5. `apps/api/src/config/env.validation.ts` — all 92 lines. The `EnvironmentVariables` class, the decorator-per-variable style with defaults as property initialisers (**lines 30–70**), and `validateEnv` (**lines 73–92**) which throws on boot. `UPLOAD_DIR` and `MAX_UPLOAD_BYTES` are added there in task 1.
6. `apps/api/.env.example` — the section-comment format (`# --- Authentication ---`). A new `# --- Attachments ---` section goes at the end.
7. `apps/api/src/main.ts` **lines 27–34** — the global `ValidationPipe`. **It does not run on a `multipart/form-data` body's file part**; only the DTO fields are validated. Every file-shaped rule in this story is therefore enforced in the service, not by a decorator.
8. `apps/api/src/common/filters/all-exceptions.filter.ts` **lines 38–47** — how an `HttpException` becomes the response envelope. A `PayloadTooLargeException` arrives at the client as `413` with your message; **no filter change is needed**.
9. `apps/api/src/auth/types/authenticated-user.ts` — `caller.id` is the author on every write here; `caller.permissions` is what the note-deletion rule inspects.
10. `apps/api/prisma/seed.ts` **lines 41–58** (as Story 09 left it) — confirm `notes:write`, `attachments:write`, and `interactions:write` are present before naming them in a decorator.
11. Run `ls node_modules/@types` from the repo root. **`@types/multer` is absent** (verified while planning); `multer` itself is present at version 2.2.0 as a dependency of `@nestjs/platform-express`. Task 1 installs the types.

---

## Backend Tasks

### 1 — Configuration and dependencies

**Install** from the repo root — types only, no native build step, consistent with the constraint that has governed every dependency choice in this repository:

```bash
npm install --save-dev @types/multer --workspace @crm/api
```

Without it, `Express.Multer.File` is not a known type and `apps/api` fails `npm run typecheck`.

**File: `apps/api/src/config/env.validation.ts`** — add to `EnvironmentVariables`, after `JWT_REFRESH_TTL_DAYS` (**line 70**):

```ts
  /** Directory attachment bytes are written to. Relative paths resolve from the
   *  API's working directory (apps/api). Must be writable by the process. */
  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR: string = './var/uploads';

  /** Hard ceiling on a single upload, in bytes. Default 10 MiB. */
  @IsInt()
  @Min(1024)
  @Max(52_428_800)
  MAX_UPLOAD_BYTES: number = 10_485_760;
```

`IsString`, `IsNotEmpty`, `IsInt`, `Min`, and `Max` are all already imported at **lines 1–13**.

**File: `apps/api/.env.example`** — append:

```
# --- Attachments (Story 11) ---
# Where customer attachment bytes are written. Relative to apps/api.
# The directory is created on demand and is NOT committed — see .gitignore.
UPLOAD_DIR=./var/uploads
# Maximum size of a single upload, in bytes. 10 MiB.
MAX_UPLOAD_BYTES=10485760
```

**File: `.gitignore`** (repo root) — add to the `# --- Project ---` block, below `coverage/`:

```
# Attachment bytes (Story 11) — never committed
apps/api/var/
```

**Do not** commit an `apps/api/var/` placeholder. The storage service creates the tree on demand.

### 2 — `AttachmentStorageService`

**Create file: `apps/api/src/customers/attachment-storage.service.ts`**

The only module in this repository that touches the filesystem. Keep every path decision inside it.

```ts
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';

/** Mime type → the extension we give the stored file. The client's filename is
 *  NEVER consulted for this: it is attacker-controlled. A type absent from this
 *  map is rejected before any byte is written. SVG is excluded deliberately —
 *  it is executable markup in a browser. */
export const ALLOWED_MIME_TYPES: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

export interface StoredFile {
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
}

@Injectable()
export class AttachmentStorageService {
  private readonly logger = new Logger(AttachmentStorageService.name);
  private readonly baseDir: string;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    // Resolved ONCE, at construction. Every later path is checked against this
    // absolute prefix, so a relative UPLOAD_DIR cannot shift under a chdir.
    this.baseDir = resolve(configService.get('UPLOAD_DIR', { infer: true }));
  }

  async save(customerId: string, buffer: Buffer, mimeType: string): Promise<StoredFile> {
    const extension = ALLOWED_MIME_TYPES[mimeType];

    if (!extension) {
      // Unreachable: the service validates the type first. Failing loudly here
      // means a future caller cannot bypass the whitelist by calling save().
      throw new InternalServerErrorException('Unsupported attachment type.');
    }

    const storageKey = `customers/${customerId}/${randomUUID()}${extension}`;
    const absolute = this.resolveKey(storageKey);

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, buffer);

    return {
      storageKey,
      checksumSha256: createHash('sha256').update(buffer).digest('hex'),
      sizeBytes: buffer.byteLength,
    };
  }

  createStream(storageKey: string): ReturnType<typeof createReadStream> {
    return createReadStream(this.resolveKey(storageKey));
  }

  /** Best effort: a missing file is not an error, because the row is gone
   *  already and an orphaned file is harmless. */
  async remove(storageKey: string): Promise<void> {
    try {
      await rm(this.resolveKey(storageKey), { force: true });
    } catch (error) {
      this.logger.warn({ err: error, storageKey }, 'Failed to remove attachment file');
    }
  }

  /**
   * Containment check. Keys are generated by this class, so traversal is not
   * reachable today — this is the guard that keeps it unreachable if a key ever
   * comes from the database after a manual edit, or from a future import tool.
   */
  private resolveKey(storageKey: string): string {
    const absolute = resolve(join(this.baseDir, storageKey));

    if (absolute !== this.baseDir && !absolute.startsWith(this.baseDir + sep)) {
      throw new InternalServerErrorException('Invalid attachment storage key.');
    }

    return absolute;
  }
}
```

`resolve` and `sep` come from `node:path`, so this is correct on Windows (`\`) and POSIX (`/`) alike — the tree is developed on Windows.

### 3 — Notes

**Create file: `apps/api/src/customers/dto/note.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { UserRefDto } from './customer-response.dto';

export class CreateNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

/** Same single field, separate class: PATCH and POST diverge the moment either
 *  gains a field, and a shared class makes that a breaking edit in two places. */
export class UpdateNoteDto extends CreateNoteDto {}

export class NoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

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

**Create file: `apps/api/src/customers/notes.service.ts`**

- `NOTE_SELECT` with `satisfies Prisma.CustomerNoteSelect`, embedding `author: { select: USER_REF_SELECT }` imported from `customers.service.ts`.
- `list(customerId)` — `assertCustomerExists` first (delegate to `CustomersService`), then `findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } })`. **No pagination**: a note list is bounded by human effort, and Story 12 renders it whole.
- `create(customerId, dto, caller)` — `body: dto.body.trim()`, `authorId: caller.id`; log `{ actorId, customerId, noteId }`.
- `update(customerId, id, dto, caller)` — load the note scoped by **both** ids (`findFirst({ where: { id, customerId } })`); `404` when absent; then:

```ts
    if (note.authorId !== caller.id) {
      throw new ForbiddenException('Only the author can edit a note.');
    }
```

- `remove(customerId, id, caller)` — same scoped load, then allow when `note.authorId === caller.id || caller.permissions.includes('customers:archive')`, else `403` with "Only the author or a customer administrator can delete a note." Returns `void` (the route is `204`).

**Create file: `apps/api/src/customers/notes.controller.ts`**

`@ApiTags('customer-notes')`, `@Controller('customers/:customerId/notes')`, the standard `@ApiBearerAuth` / `@ApiUnauthorizedResponse` / `@ApiForbiddenResponse` stack.

| Method | Route | Permission | Response |
|---|---|---|---|
| `list` | `GET /` | `customers:read` | `[NoteResponseDto]` |
| `create` | `POST /` | `notes:write` | `201` `NoteResponseDto` |
| `update` | `PATCH /:id` | `notes:write` | `200` `NoteResponseDto` |
| `remove` | `DELETE /:id` | `notes:write` | `204` |

**Both** `customerId` and `id` take `ParseUUIDPipe`.

### 4 — Interactions

**Create file: `apps/api/src/customers/dto/interaction.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionChannel, InteractionDirection } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRefDto } from './customer-response.dto';

export class CreateInteractionDto {
  @ApiProperty({ enum: InteractionChannel })
  @IsEnum(InteractionChannel)
  channel!: InteractionChannel;

  @ApiProperty({ enum: InteractionDirection })
  @IsEnum(InteractionDirection)
  direction!: InteractionDirection;

  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string;

  @ApiPropertyOptional({ maxLength: 8000 })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @ApiProperty({ format: 'date-time', description: 'When it happened. Not more than 5 minutes in the future.' })
  @IsDateString()
  occurredAt!: string;
}
```

`@IsDateString()`, not `@IsDate()`: the value arrives as a JSON string, and `enableImplicitConversion` does not turn it into a `Date`. The service parses it.

`InteractionResponseDto` mirrors `NoteResponseDto` with `channel`, `direction`, `subject`, `body: string | null`, `occurredAt`, `createdAt`, and a `createdBy: UserRefDto`.

**Create file: `apps/api/src/customers/interactions.service.ts`**

- `list(customerId)` — `orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }]`. The second key breaks ties deterministically when two interactions share a timestamp; without it, pagination-free rendering still flickers between requests.
- `create(customerId, dto, caller)`:

```ts
    const occurredAt = new Date(dto.occurredAt);
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    if (occurredAt.getTime() > Date.now() + FIVE_MINUTES_MS) {
      throw new BadRequestException('occurredAt cannot be in the future.');
    }
```

  Back-dating is unrestricted and normal.
- `remove(customerId, id, caller)` — scoped load, author-or-`customers:archive` rule identical to notes, `204`.
- **No `update`.**

**Create file: `apps/api/src/customers/interactions.controller.ts`** — `@Controller('customers/:customerId/interactions')`, `@ApiTags('customer-interactions')`. `GET` needs `customers:read`; `POST` and `DELETE` need `interactions:write`.

### 5 — Attachments

**Create file: `apps/api/src/customers/dto/attachment.dto.ts`**

```ts
export class AttachmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: 'signed-contract.pdf', description: "The client's original filename. Display only." })
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 148_320 })
  sizeBytes!: number;

  @ApiProperty({ example: 'e3b0c442…', description: 'SHA-256 of the stored bytes. Recorded, not enforced.' })
  checksumSha256!: string;

  @ApiProperty({ type: () => UserRefDto })
  uploadedBy!: UserRefDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
```

**`storageKey` is deliberately absent from the response.** It is an internal path; publishing it invites a client to construct one.

**Create file: `apps/api/src/customers/attachments.service.ts`**

```ts
export const MAX_ATTACHMENTS_PER_CUSTOMER = 20;
```

`create(customerId, file: Express.Multer.File, caller)`, in **this order** — each check before any side effect:

1. `await this.customersService.assertExists(customerId)` → `404`.
2. `if (!file) throw new BadRequestException('A file is required under the field name "file".')` — the request reached the handler with no part, which `ValidationPipe` cannot catch.
3. Type: `if (!(file.mimetype in ALLOWED_MIME_TYPES)) throw new BadRequestException(\`Unsupported file type: ${file.mimetype}\`)`.
4. Size: `if (file.size > maxBytes) throw new PayloadTooLargeException(...)` — belt and braces beside multer's own `limits`, because the limit is configuration and the two must not drift.
5. Count: `const count = await this.prisma.customerAttachment.count({ where: { customerId } })`; over `MAX_ATTACHMENTS_PER_CUSTOMER` → `BadRequestException`.
6. `const stored = await this.storage.save(customerId, file.buffer, file.mimetype)`.
7. `prisma.customerAttachment.create` with `fileName: AttachmentsService.sanitiseFileName(file.originalname)`, `storageKey`, `mimeType`, `sizeBytes`, `checksumSha256`, `uploadedById: caller.id`. **If the insert throws, remove the file** in a `catch` before re-throwing — the one place where the write-bytes-first ordering needs a compensating action.
8. Log `{ actorId, customerId, attachmentId, sizeBytes }`.

```ts
  /** The original name is display-only, but it lands in a Content-Disposition
   *  header and in the DOM. Strip anything path-like or control-ish and cap it;
   *  the STORED name is generated separately and never derived from this. */
  private static sanitiseFileName(original: string): string {
    // eslint-disable-next-line no-control-regex
    const cleaned = original.replace(/[ -/\\]/g, '_').trim();

    return (cleaned.length > 0 ? cleaned : 'attachment').slice(0, 200);
  }
```

`remove(customerId, id, caller)` — scoped `findFirst`; author-or-`customers:archive`; **delete the row first**, then `await this.storage.remove(row.storageKey)`. A failure in the second step is logged, not thrown: the row is already gone and the download can no longer break.

`getForDownload(customerId, id)` — scoped `findFirst` returning `{ fileName, mimeType, sizeBytes, storageKey }`; `404` when absent.

**Create file: `apps/api/src/customers/attachments.controller.ts`**

```ts
  @Post()
  @RequirePermissions('attachments:write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: AttachmentResponseDto })
  @ApiBadRequestResponse({ description: 'Missing file, unsupported type, or the per-customer limit.' })
  create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AttachmentResponseDto> {
    return this.attachmentsService.create(customerId, file, caller);
  }
```

`memoryStorage()` is chosen so multer never writes a temporary file: a rejected upload leaves nothing behind, and the service — not the framework — decides where a byte lands. At 10 MB per request that is an acceptable buffer.

`@ApiConsumes` and the explicit `@ApiBody` schema are what make the upload testable from `/api/docs`; without them Swagger renders a JSON body and the endpoint appears broken.

The download route:

```ts
  @Get(':id/content')
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'Download an attachment',
    description: 'Always served as an attachment, never inline — see the security note in the plan.',
  })
  @ApiOkResponse({ description: 'The file bytes.' })
  async download(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const attachment = await this.attachmentsService.getForDownload(customerId, id);

    res.set({
      'Content-Type': attachment.mimeType,
      // ALWAYS attachment. The SPA and the API share an origin through the Vite
      // proxy, so an inline-rendered upload would be stored XSS against the CRM.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'Content-Length': String(attachment.sizeBytes),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });

    return new StreamableFile(this.attachmentsService.createStream(attachment.storageKey));
  }
```

`@Res({ passthrough: true })` keeps Nest in charge of the response while letting you set headers — **without `passthrough: true` the `StreamableFile` return is ignored and the request hangs.** This is the only route in the repository using `@Res`; the `import type { Response } from 'express'` mirrors `jwt-auth.guard.ts` line 10.

`filename*=UTF-8''…` rather than plain `filename=` so Arabic and other non-ASCII names survive the header.

### 6 — Module wiring

**File: `apps/api/src/customers/customers.module.ts`** — register the three controllers and four providers:

```ts
  controllers: [CustomersController, NotesController, AttachmentsController, InteractionsController],
  providers: [
    CustomersService,
    NotesService,
    AttachmentsService,
    InteractionsService,
    AttachmentStorageService,
  ],
```

Route order inside one module does not matter here — `customers/:customerId/notes` and `customers/:id` cannot collide, because the first has three segments and the second has two.

**File: `apps/api/src/main.ts`** — add `.addTag('customer-notes', …)`, `.addTag('customer-attachments', …)`, and `.addTag('customer-interactions', …)` beside the existing tags (**lines 46–49**).

---

## Edge Cases & Failure Modes

- **An unknown `customerId` on any nested route.** `404` before any child query, enforced by calling `CustomersService.assertExists` as the **first** statement of every service method. Without it, `GET …/notes` on a nonexistent customer would return a cheerful empty array.
- **A note id that belongs to another customer.** `findFirst({ where: { id, customerId } })` returns nothing → `404`. Never `403`, which would confirm the row exists. Every child lookup in this story is scoped by both ids for exactly this reason.
- **Editing somebody else's note.** `403` "Only the author can edit a note." A `system-administrator` is **not** exempt — editing under another agent's byline is the thing the rule exists to prevent. Deleting is the escape hatch, and it is gated on `customers:archive`.
- **Uploading with no file part**, or under the wrong field name. `@UploadedFile()` yields `undefined` and the service throws `400` naming the expected field. `ValidationPipe` cannot catch this: it never sees the multipart body.
- **A file over 10 MB.** Multer's `limits.fileSize` aborts first and Nest surfaces `413`. The service's own check is unreachable in the default configuration and stays as the guard for a raised multer limit.
- **`MAX_UPLOAD_BYTES` raised above the interceptor's hard-coded 10 MB.** The interceptor wins and the config is silently ignored. **Flagged uncertainty:** wiring `ConfigService` into a `FileInterceptor` option requires `MulterModule.registerAsync` or a custom interceptor factory, which is more machinery than this story justifies. Keep the two numbers equal and note it in the `.env.example` comment.
- **A disguised file** — a `.exe` renamed `.pdf` with a forged `Content-Type`. **It is accepted.** Multer reports the client's declared type; nothing here reads magic bytes. The mitigations that matter are that the file is never executed, never served inline, and always downloaded with `nosniff`. Content inspection and virus scanning are **out of scope** and recorded in the overview.
- **A client filename of `../../.env`.** Stored as `9f3c….pdf` regardless: the extension comes from the whitelist map, the basename from `randomUUID()`. The sanitised original survives only in `fileName` and in the `Content-Disposition` header, percent-encoded.
- **`UPLOAD_DIR` not writable, or the disk full.** `mkdir`/`writeFile` reject, the exception filter logs it and returns `500`, and **no database row is created** — the write-bytes-first ordering means a failed upload leaves nothing to clean up. The API still boots: the directory is created on first upload, not at startup, so a misconfigured path fails one request rather than the whole service.
- **The row insert fails after the bytes landed.** The `catch` removes the file before re-throwing. If *that* removal also fails, an orphaned file remains — logged, harmless, and invisible to every API.
- **A file missing from disk on download.** `createReadStream` emits `ENOENT` asynchronously, after headers were sent, so the client sees a truncated response rather than a clean `404`. Comes from a restored database pointed at an empty `UPLOAD_DIR`. **Documented, not defended:** an `access()` pre-check races anyway, and the honest fix is keeping the two stores together in backups.
- **`occurredAt` five minutes ahead.** Accepted (clock skew). Six minutes ahead: `400`. A year ago: accepted, and normal.
- **`occurredAt` as `'not-a-date'`.** `@IsDateString()` rejects it as `400` before the service parses anything.
- **Two interactions with identical `occurredAt`.** Ordered by `createdAt` descending as a tiebreak, so the list is stable across requests.
- **A 4000-character note of pure emoji.** Accepted — `@MaxLength` counts UTF-16 code units, so an emoji costs two. The database column is unbounded `TEXT`; the limit is a UI concern.
- **Deleting a customer.** Cannot happen — Story 10 exposes no `DELETE`. The `onDelete: Cascade` in the schema would clear the child rows and leave every file on disk. Recorded so that whoever eventually adds a purge tool knows to sweep `UPLOAD_DIR` too.

---

## Test Plan

1. **Unit — new file `apps/api/src/customers/attachment-storage.service.spec.ts`.** Use a temporary directory: `mkdtemp(join(tmpdir(), 'crm-attach-'))` in `beforeAll`, `rm(..., { recursive: true, force: true })` in `afterAll`. Construct the service with a stub `ConfigService` whose `get` returns that path.
   - `save` writes a file, and the returned `storageKey` matches `customers/<uuid>/<uuid>.pdf`.
   - The returned `checksumSha256` equals an independently computed SHA-256 of the buffer.
   - `save` with a mime type absent from the whitelist throws.
   - `save` creates the nested directory when it does not exist.
   - `remove` deletes the file; calling it twice does **not** throw.
   - `createStream` on a saved key yields the original bytes.
   - **The traversal test:** `createStream('../../../etc/passwd')` and `remove('..\\..\\secrets')` both throw, and neither reads nor removes anything outside the temporary directory.
2. **Unit — new file `apps/api/src/customers/notes.service.spec.ts`**, following `users.service.spec.ts` **lines 1–70** for the mock style.
   - `list` orders by `createdAt` descending and scopes by `customerId`.
   - `create` trims the body and sets `authorId` from the caller.
   - `update` by a non-author throws `ForbiddenException` and never calls `prisma.customerNote.update`.
   - `update` on a note from another customer throws `NotFoundException` — assert the `where` passed to `findFirst` contains **both** ids.
   - `remove` by the author succeeds; by a stranger without `customers:archive` throws; by a stranger **with** `customers:archive` succeeds.
3. **Unit — new file `apps/api/src/customers/interactions.service.spec.ts`.**
   - `create` with `occurredAt` one hour in the past succeeds.
   - `create` with `occurredAt` two minutes ahead succeeds (skew tolerance).
   - `create` with `occurredAt` one hour ahead throws `BadRequestException`. Freeze time with `jest.useFakeTimers().setSystemTime(...)` and restore it in `afterEach`.
   - `list` orders by `occurredAt` then `createdAt`, both descending.
   - No `update` method exists on the service — assert with `expect((service as unknown as Record<string, unknown>).update).toBeUndefined()`, so a later "helpful" addition trips a test.
4. **Unit — new file `apps/api/src/customers/attachments.service.spec.ts`** with a mocked `AttachmentStorageService`.
   - An unsupported mime type throws **before** `storage.save` is called.
   - The 21st attachment for one customer throws; the 20th succeeds.
   - A rejected `prisma.customerAttachment.create` triggers `storage.remove` with the key just written, then re-throws.
   - `remove` deletes the row **before** calling `storage.remove` — assert call ordering with `mock.invocationCallOrder`.
   - `remove` still resolves when `storage.remove` rejects.
   - `sanitiseFileName` turns `../../evil.pdf` into a name containing no `/` or `\`, and an empty name into `attachment`.
5. **Integration — new file `apps/api/test/customer-children.e2e-spec.ts`.** Same bootstrap as `apps/api/test/users.e2e-spec.ts` **lines 56–102**. Create one customer fixture named `E2E Children Fixture` in `beforeAll`; in `afterAll` delete it (children cascade) and `rm` the `UPLOAD_DIR` subtree the test wrote.
   - **Notes:** `POST` → 201 with `author` populated; `GET` lists it; `PATCH` as the author → 200; `PATCH` as a second user → **403**; `DELETE` as that second user → **403**; `DELETE` as the author → **204**; `GET …/notes/:id` on another customer's note → **404**; `POST` with `body: ''` → **400**.
   - **Interactions:** `POST` with a past `occurredAt` → 201; with `occurredAt` a day ahead → **400**; with `channel: 'CARRIER_PIGEON'` → **400**; `GET` returns newest-occurred first; `DELETE` → 204. Assert **no** `PATCH` route exists: `PATCH …/interactions/:id` → **404**.
   - **Attachments:** `POST` with `.attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'contract.pdf', contentType: 'application/pdf' })` → **201**, `fileName: 'contract.pdf'`, `sizeBytes` matching, `checksumSha256` 64 hex characters, and **no `storageKey`** in the body.
   - `POST` with `contentType: 'image/svg+xml'` → **400** — the SVG exclusion.
   - `POST` with an 11 MB buffer → **413**.
   - `POST` with no file part → **400**.
   - `POST` with `filename: '../../../evil.pdf'` → **201**, and the response `fileName` contains no `/`.
   - `GET …/attachments/:id/content` → **200**, `content-disposition` starting `attachment;`, `x-content-type-options: nosniff`, and the body bytes equal to what was uploaded.
   - `DELETE …/attachments/:id` → **204**, then `GET …/content` → **404**.
   - **Permission block:** as a `reporting-user` (holds `customers:read` only) — `GET` on all three collections → **200**; `POST` on each → **403**, naming `notes:write`, `attachments:write`, and `interactions:write` respectively.
   - Every nested route with a random `customerId` → **404**.
6. **No frontend test.** Story 12 owns those.

---

## Verification Steps

1. **Types installed:** from the repo root, confirm `@types/multer` appears in `apps/api/package.json` under `devDependencies` and that `ls node_modules/@types/multer` succeeds.
2. **Backend type-checks, lints, builds:** from `apps/api`, `npm run typecheck`, `npm run lint`, `npm run build`. All exit 0. A missing `@types/multer` fails the first.
3. **The API refuses a bad config:** temporarily set `MAX_UPLOAD_BYTES=10` in `apps/api/.env` and start the API. Expect the boot to fail with "Invalid environment configuration" naming the minimum. **Restore the value.**
4. **Unit tests:** from `apps/api`, `npm test`. Green, including the four new specs.
5. **e2e tests:** from `apps/api`, `npm run test:e2e`. Green, including `customer-children.e2e-spec.ts`.
6. **Nothing committed from `var/`:** run `git status --porcelain apps/api/var` after the e2e run. Expect **no output** — the gitignore entry is working.
7. **Swagger:** open `http://localhost:3000/api/docs`. Expect **customer-notes**, **customer-attachments**, and **customer-interactions** tags, and the attachment `POST` rendering a **file picker** rather than a JSON body.
8. **Manual — notes:** authorise in Swagger as the administrator, create a customer, `POST` a note, `GET` the list, `PATCH` your own note. Expect 201 / 200 / 200. **This is half of the acceptance criterion "Customer notes and attachments can be managed."**
9. **Manual — the author rule:** create a second user with `support-agent`, sign in as them, and `PATCH` the administrator's note. Expect **403** reading "Only the author can edit a note."
10. **Manual — upload and download:** as the administrator, `POST` a real PDF to `/api/customers/{id}/attachments`. Expect 201. Then open `GET …/{attachmentId}/content` in a browser tab with a valid session — expect the browser to **download** the file, not display it, and the bytes to open correctly. **This is the other half of the notes-and-attachments criterion.**
11. **Manual — the disk layout:** confirm `apps/api/var/uploads/customers/<customerId>/` holds one file whose name is a uuid with a `.pdf` extension, and that the client's original filename appears **nowhere** on disk.
12. **Manual — the type gate:** try to upload a `.svg` and an `.exe`. Expect **400** for both, and **no** new file under `apps/api/var/uploads`.
13. **Manual — interactions:** `POST` three interactions with different `occurredAt` values, one back-dated a week. `GET` the list and confirm newest-occurred first. Then `POST` one dated tomorrow — expect **400**. **This is the acceptance criterion "Customer ticket/history information is accessible from the profile", as far as this work item can deliver it: interactions ship now, tickets join the same timeline when their work item lands.**
14. **Manual — the count limit:** upload 20 small files to one customer, then a 21st. Expect **400** naming the limit.
15. **Regression:** `GET /api/customers` and `GET /api/customers/{id}` still work, and the detail response's `counts` now reflects the notes, attachments, and interactions created above — the proof that Story 10's `_count` projection and this story's tables agree.
16. **Regression:** `GET /api/users`, `GET /api/health`, and `POST /api/auth/login` all behave as before.
17. **Regression:** from the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.
18. **Regression:** `npx prisma migrate status` from `apps/api` reports no pending migrations — this story added none.

---

## Done Criteria

- [ ] `@types/multer` is a devDependency of `@crm/api`, and no other dependency was added.
- [ ] `UPLOAD_DIR` and `MAX_UPLOAD_BYTES` exist in `EnvironmentVariables` with defaults and validation, are documented in `apps/api/.env.example`, and `apps/api/var/` is gitignored.
- [ ] `AttachmentStorageService` resolves `baseDir` **once** in its constructor and every path passes a containment check against it; the traversal unit test proves it.
- [ ] Stored filenames are `randomUUID()` plus an extension from `ALLOWED_MIME_TYPES`; the client's filename is used **only** for display and is sanitised of path separators and control characters.
- [ ] `ALLOWED_MIME_TYPES` holds the eleven listed types and **excludes** `image/svg+xml`.
- [ ] The download route sets `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and an RFC 5987 `filename*` so non-ASCII names survive; it uses `@Res({ passthrough: true })` with `StreamableFile`.
- [ ] `storageKey` never appears in an API response.
- [ ] Uploads write bytes first and insert the row second, and a failed insert removes the file it just wrote.
- [ ] Deletes remove the row first and the file second, and a failed file removal is logged rather than thrown.
- [ ] Every nested route calls `CustomersService.assertExists` first and returns **404** for an unknown customer; every child lookup is scoped by **both** `customerId` and `id`.
- [ ] Notes are editable only by their author; deletable by the author or a holder of `customers:archive`. Interactions have **no** update route.
- [ ] `occurredAt` more than five minutes in the future is **400**; back-dating is unrestricted.
- [ ] Per-file size (10 MB) and per-customer count (20) limits are enforced and produce **413** and **400** respectively.
- [ ] `customers:read` alone permits reading all three collections; writing each requires `notes:write`, `attachments:write`, or `interactions:write`.
- [ ] All four unit specs and `customer-children.e2e-spec.ts` exist and pass, including the traversal, SVG-rejection, oversize, author-rule, and download-header tests.
- [ ] Story 10's `counts` on the customer detail response reflects the new rows.
- [ ] This story added **no** migration and modified **no** frontend file.
- [ ] From the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 12.**
