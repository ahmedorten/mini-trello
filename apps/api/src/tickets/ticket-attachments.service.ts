import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { EnvironmentVariables } from '../config/env.validation';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ALLOWED_MIME_TYPES, AttachmentStorageService } from '../common/attachment-storage.service';
import { USER_REF_SELECT } from '../customers/customers.service';
import { TICKET_MANAGE_PERMISSION, TicketsService } from './tickets.service';
import { TicketAttachmentResponseDto } from './dto/ticket-attachment.dto';

export const MAX_ATTACHMENTS_PER_TICKET = 20;

const TICKET_ATTACHMENT_SELECT = {
  id: true,
  ticketId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  checksumSha256: true,
  createdAt: true,
  uploadedById: true,
  uploadedBy: { select: USER_REF_SELECT },
} satisfies Prisma.TicketAttachmentSelect;

type SelectedTicketAttachment = Prisma.TicketAttachmentGetPayload<{
  select: typeof TICKET_ATTACHMENT_SELECT;
}>;

@Injectable()
export class TicketAttachmentsService {
  private readonly logger = new Logger(TicketAttachmentsService.name);
  private readonly maxUploadBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    private readonly storage: AttachmentStorageService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxUploadBytes = configService.get('MAX_UPLOAD_BYTES', { infer: true });
  }

  async list(ticketId: string): Promise<TicketAttachmentResponseDto[]> {
    await this.ticketsService.assertExists(ticketId);

    const attachments = await this.prisma.ticketAttachment.findMany({
      where: { ticketId },
      select: TICKET_ATTACHMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return attachments.map((attachment) => TicketAttachmentsService.toResponse(attachment));
  }

  async create(
    ticketId: string,
    file: Express.Multer.File,
    caller: AuthenticatedUser,
  ): Promise<TicketAttachmentResponseDto> {
    await this.ticketsService.assertExists(ticketId);

    if (!file) {
      throw new BadRequestException('A file is required under the field name "file".');
    }

    if (!(file.mimetype in ALLOWED_MIME_TYPES)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    if (file.size > this.maxUploadBytes) {
      throw new PayloadTooLargeException(
        `File exceeds the maximum upload size of ${this.maxUploadBytes} bytes.`,
      );
    }

    const count = await this.prisma.ticketAttachment.count({ where: { ticketId } });

    if (count >= MAX_ATTACHMENTS_PER_TICKET) {
      throw new BadRequestException(
        `A ticket may hold at most ${MAX_ATTACHMENTS_PER_TICKET} attachments.`,
      );
    }

    const stored = await this.storage.save('tickets', ticketId, file.buffer, file.mimetype);

    try {
      const created = await this.prisma.ticketAttachment.create({
        data: {
          ticketId,
          uploadedById: caller.id,
          fileName: TicketAttachmentsService.sanitiseFileName(file.originalname),
          storageKey: stored.storageKey,
          mimeType: file.mimetype,
          sizeBytes: stored.sizeBytes,
          checksumSha256: stored.checksumSha256,
        },
        select: TICKET_ATTACHMENT_SELECT,
      });

      this.logger.log(
        { actorId: caller.id, ticketId, attachmentId: created.id, sizeBytes: created.sizeBytes },
        'Ticket attachment uploaded',
      );

      return TicketAttachmentsService.toResponse(created);
    } catch (error) {
      // The write-bytes-first ordering needs this one compensating action: the
      // insert failed, so the file just written would otherwise be orphaned.
      await this.storage.remove(stored.storageKey);
      throw error;
    }
  }

  async remove(ticketId: string, id: string, caller: AuthenticatedUser): Promise<void> {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id, ticketId },
      select: { id: true, storageKey: true, uploadedById: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    if (
      attachment.uploadedById !== caller.id &&
      !caller.permissions.includes(TICKET_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenException(
        'Only the uploader or a ticket administrator can delete an attachment.',
      );
    }

    // Row first, file second: a failed file removal leaves an orphaned file,
    // which is invisible and harmless. The reverse would leave a row pointing
    // at nothing — a broken download. The row is already gone by the time we
    // touch the filesystem, so a failure here is logged, never thrown.
    await this.prisma.ticketAttachment.delete({ where: { id } });

    try {
      await this.storage.remove(attachment.storageKey);
    } catch (error) {
      this.logger.warn(
        { err: error, ticketId, attachmentId: id },
        'Attachment row deleted but file removal failed',
      );
    }

    this.logger.log(
      { actorId: caller.id, ticketId, attachmentId: id },
      'Ticket attachment deleted',
    );
  }

  async getForDownload(
    ticketId: string,
    id: string,
  ): Promise<{ fileName: string; mimeType: string; sizeBytes: number; storageKey: string }> {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id, ticketId },
      select: { fileName: true, mimeType: true, sizeBytes: true, storageKey: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    return attachment;
  }

  createStream(storageKey: string): ReturnType<AttachmentStorageService['createStream']> {
    return this.storage.createStream(storageKey);
  }

  /** The original name is display-only, but it lands in a Content-Disposition
   *  header and in the DOM. Strip anything path-like or control-ish and cap it;
   *  the STORED name is generated separately and never derived from this. */
  private static sanitiseFileName(original: string): string {
    // eslint-disable-next-line no-control-regex
    const cleaned = original.replace(/[\x00-\x1f/\\]/g, '_').trim();

    return (cleaned.length > 0 ? cleaned : 'attachment').slice(0, 200);
  }

  private static toResponse(attachment: SelectedTicketAttachment): TicketAttachmentResponseDto {
    return {
      id: attachment.id,
      ticketId: attachment.ticketId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      checksumSha256: attachment.checksumSha256,
      uploadedBy: attachment.uploadedBy,
      createdAt: attachment.createdAt.toISOString(),
    };
  }
}
