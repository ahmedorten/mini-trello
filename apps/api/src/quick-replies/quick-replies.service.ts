import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { USER_REF_SELECT } from '../customers/customers.service';
import {
  CreateQuickReplyDto,
  ListQuickRepliesQueryDto,
  QuickReplyResponseDto,
  UpdateQuickReplyDto,
} from './dto/quick-reply.dto';

export const QUICK_REPLY_WRITE_PERMISSION = 'quick-replies:write';

/** The ONLY projection used for quick-reply responses. */
const QUICK_REPLY_SELECT = {
  id: true,
  key: true,
  locale: true,
  title: true,
  body: true,
  channel: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: USER_REF_SELECT },
} satisfies Prisma.QuickReplySelect;

type SelectedQuickReply = Prisma.QuickReplyGetPayload<{ select: typeof QUICK_REPLY_SELECT }>;

@Injectable()
export class QuickRepliesService {
  private readonly logger = new Logger(QuickRepliesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuickRepliesQueryDto,
    caller: AuthenticatedUser,
  ): Promise<QuickReplyResponseDto[]> {
    const where: Prisma.QuickReplyWhereInput = {};

    if (query.locale) where.locale = query.locale;

    // A bare `channel: query.channel` would hide every channel-agnostic reply
    // (channel: null) and make the picker look broken.
    if (query.channel) where.OR = [{ channel: query.channel }, { channel: null }];

    // Product rule 13: includeInactive is honoured ONLY for a quick-replies:write
    // holder. Anyone else gets isActive: true regardless — the flag is silently
    // ignored, not rejected, per the Edge Cases note.
    if (!(query.includeInactive && caller.permissions.includes(QUICK_REPLY_WRITE_PERMISSION))) {
      where.isActive = true;
    }

    // Not paginated — the catalogue is small and the frontend loads it whole
    // for a picker, same reasoning as listAgents().
    const rows = await this.prisma.quickReply.findMany({
      where,
      select: QUICK_REPLY_SELECT,
      orderBy: [{ key: 'asc' }, { locale: 'asc' }],
    });

    return rows.map((row) => QuickRepliesService.toResponse(row));
  }

  async findOne(id: string): Promise<QuickReplyResponseDto> {
    const row = await this.prisma.quickReply.findUnique({
      where: { id },
      select: QUICK_REPLY_SELECT,
    });

    if (!row) {
      throw new NotFoundException('Quick reply not found.');
    }

    return QuickRepliesService.toResponse(row);
  }

  async create(
    dto: CreateQuickReplyDto,
    caller: AuthenticatedUser,
  ): Promise<QuickReplyResponseDto> {
    try {
      const created = await this.prisma.quickReply.create({
        data: {
          key: dto.key.trim(),
          locale: dto.locale.trim(),
          title: dto.title.trim(),
          body: dto.body.trim(),
          channel: dto.channel,
          isActive: dto.isActive,
          createdById: caller.id,
        },
        select: QUICK_REPLY_SELECT,
      });

      this.logger.log({ actorId: caller.id, quickReplyId: created.id }, 'Quick reply created');

      return QuickRepliesService.toResponse(created);
    } catch (error) {
      throw QuickRepliesService.mapPrismaError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateQuickReplyDto,
    caller: AuthenticatedUser,
  ): Promise<QuickReplyResponseDto> {
    await this.assertExists(id);

    // key and locale are immutable: UpdateQuickReplyDto never declares them, so
    // there is nothing to copy across even if a caller smuggled them in.
    const data: Prisma.QuickReplyUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.body !== undefined) data.body = dto.body.trim();
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.quickReply.update({
      where: { id },
      data,
      select: QUICK_REPLY_SELECT,
    });

    this.logger.log({ actorId: caller.id, quickReplyId: id }, 'Quick reply updated');

    return QuickRepliesService.toResponse(updated);
  }

  /** Hard delete, and a seeded row deleted this way REAPPEARS on the next
   *  `prisma:seed` run (Product rule 14). Retire with isActive: false instead. */
  async remove(id: string, caller: AuthenticatedUser): Promise<void> {
    await this.assertExists(id);

    await this.prisma.quickReply.delete({ where: { id } });

    this.logger.log({ actorId: caller.id, quickReplyId: id }, 'Quick reply deleted');
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.quickReply.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('Quick reply not found.');
    }
  }

  private static mapPrismaError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A quick reply with that key already exists for that locale.');
    }

    return error instanceof Error ? error : new Error('Unknown persistence error');
  }

  private static toResponse(row: SelectedQuickReply): QuickReplyResponseDto {
    return {
      id: row.id,
      key: row.key,
      locale: row.locale,
      title: row.title,
      body: row.body,
      channel: row.channel,
      isActive: row.isActive,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
