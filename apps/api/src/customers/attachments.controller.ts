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
import { AttachmentResponseDto } from './dto/attachment.dto';
import { AttachmentsService } from './attachments.service';

@ApiTags('customer-attachments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('customers/:customerId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: 'List a customer’s attachments, newest first' })
  @ApiOkResponse({ type: [AttachmentResponseDto] })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  list(@Param('customerId', ParseUUIDPipe) customerId: string): Promise<AttachmentResponseDto[]> {
    return this.attachmentsService.list(customerId);
  }

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
  @ApiOperation({ summary: 'Upload an attachment' })
  @ApiCreatedResponse({ type: AttachmentResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing file, unsupported type, or the per-customer limit.',
  })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AttachmentResponseDto> {
    return this.attachmentsService.create(customerId, file, caller);
  }

  @Get(':id/content')
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'Download an attachment',
    description:
      'Always served as an attachment, never inline — see the security note in the plan.',
  })
  @ApiOkResponse({ description: 'The file bytes.' })
  @ApiNotFoundResponse({ description: 'No such customer, or no such attachment on that customer.' })
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

  @Delete(':id')
  @RequirePermissions('attachments:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an attachment',
    description: 'The uploader, or a caller holding customers:archive.',
  })
  @ApiNoContentResponse({ description: 'Attachment deleted.' })
  @ApiNotFoundResponse({ description: 'No such customer, or no such attachment on that customer.' })
  remove(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.attachmentsService.remove(customerId, id, caller);
  }
}
