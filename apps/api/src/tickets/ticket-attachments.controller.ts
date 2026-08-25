import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TicketAttachmentResponseDto } from './dto/ticket-attachment.dto';
import { TicketAttachmentsService } from './ticket-attachments.service';

@ApiTags('ticket-attachments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tickets/:ticketId/attachments')
export class TicketAttachmentsController {
  constructor(private readonly ticketAttachmentsService: TicketAttachmentsService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: "List a ticket's attachments, newest first" })
  @ApiOkResponse({ type: [TicketAttachmentResponseDto] })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string): Promise<TicketAttachmentResponseDto[]> {
    return this.ticketAttachmentsService.list(ticketId);
  }

  @Post()
  @RequirePermissions('ticket-attachments:write')
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
  @ApiOperation({ summary: 'Upload an attachment to a ticket' })
  @ApiCreatedResponse({ type: TicketAttachmentResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing file, unsupported type, or the per-ticket limit.',
  })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<TicketAttachmentResponseDto> {
    return this.ticketAttachmentsService.create(ticketId, file, caller);
  }

  @Get(':id/content')
  @RequirePermissions('tickets:read')
  @ApiOperation({
    summary: 'Download a ticket attachment',
    description:
      'Always served as an attachment, never inline — see the security note in the plan.',
  })
  @ApiOkResponse({ description: 'The file bytes.' })
  @ApiNotFoundResponse({ description: 'No such ticket, or no such attachment on that ticket.' })
  async download(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const attachment = await this.ticketAttachmentsService.getForDownload(ticketId, id);

    res.set({
      'Content-Type': attachment.mimeType,
      // ALWAYS attachment. The SPA and the API share an origin through the Vite
      // proxy, so an inline-rendered upload would be stored XSS against the CRM.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'Content-Length': String(attachment.sizeBytes),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });

    return new StreamableFile(this.ticketAttachmentsService.createStream(attachment.storageKey));
  }

  @Delete(':id')
  @RequirePermissions('ticket-attachments:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a ticket attachment',
    description: 'The uploader, or a caller holding tickets:manage.',
  })
  @ApiNoContentResponse({ description: 'Attachment deleted.' })
  @ApiNotFoundResponse({ description: 'No such ticket, or no such attachment on that ticket.' })
  remove(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.ticketAttachmentsService.remove(ticketId, id, caller);
  }
}
