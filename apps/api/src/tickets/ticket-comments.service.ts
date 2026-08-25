import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { USER_REF_SELECT } from '../customers/customers.service';
import { TICKET_MANAGE_PERMISSION, TicketsService } from './tickets.service';
import { CommentResponseDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

const TICKET_COMMENT_SELECT = {
  id: true,
  ticketId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: USER_REF_SELECT },
} satisfies Prisma.TicketCommentSelect;

type SelectedComment = Prisma.TicketCommentGetPayload<{ select: typeof TICKET_COMMENT_SELECT }>;

@Injectable()
export class TicketCommentsService {
  private readonly logger = new Logger(TicketCommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  async list(ticketId: string): Promise<CommentResponseDto[]> {
    await this.ticketsService.assertExists(ticketId);

    const comments = await this.prisma.ticketComment.findMany({
      where: { ticketId },
      select: TICKET_COMMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return comments.map((comment) => TicketCommentsService.toResponse(comment));
  }

  async create(
    ticketId: string,
    dto: CreateCommentDto,
    caller: AuthenticatedUser,
  ): Promise<CommentResponseDto> {
    await this.ticketsService.assertExists(ticketId);

    const created = await this.prisma.ticketComment.create({
      data: { ticketId, authorId: caller.id, body: dto.body.trim() },
      select: TICKET_COMMENT_SELECT,
    });

    this.logger.log({ actorId: caller.id, ticketId, commentId: created.id }, 'Comment created');

    return TicketCommentsService.toResponse(created);
  }

  async update(
    ticketId: string,
    id: string,
    dto: UpdateCommentDto,
    caller: AuthenticatedUser,
  ): Promise<CommentResponseDto> {
    const comment = await this.assertScoped(ticketId, id);

    if (comment.authorId !== caller.id) {
      throw new ForbiddenException('Only the author can edit a comment.');
    }

    const updated = await this.prisma.ticketComment.update({
      where: { id },
      data: { body: dto.body.trim() },
      select: TICKET_COMMENT_SELECT,
    });

    this.logger.log({ actorId: caller.id, ticketId, commentId: id }, 'Comment updated');

    return TicketCommentsService.toResponse(updated);
  }

  async remove(ticketId: string, id: string, caller: AuthenticatedUser): Promise<void> {
    const comment = await this.assertScoped(ticketId, id);

    if (comment.authorId !== caller.id && !caller.permissions.includes(TICKET_MANAGE_PERMISSION)) {
      throw new ForbiddenException(
        'Only the author or a ticket administrator can delete a comment.',
      );
    }

    await this.prisma.ticketComment.delete({ where: { id } });

    this.logger.log({ actorId: caller.id, ticketId, commentId: id }, 'Comment deleted');
  }

  private async assertScoped(ticketId: string, id: string): Promise<SelectedComment> {
    const comment = await this.prisma.ticketComment.findFirst({
      where: { id, ticketId },
      select: TICKET_COMMENT_SELECT,
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    return comment;
  }

  private static toResponse(comment: SelectedComment): CommentResponseDto {
    return {
      id: comment.id,
      ticketId: comment.ticketId,
      author: comment.author,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }
}
