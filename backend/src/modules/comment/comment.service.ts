import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';
import { CreateCommentInput, UpdateCommentInput } from './comment.schema';
import { ActivityService, CommentActivityDetails } from '../activity/activity.service';
import { ActivityAction } from '@prisma/client';

export interface CommentResponse {
  id: string;
  cardId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const commentSelect = {
  id: true,
  cardId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  version: true,
};

export class CommentService {
  private readonly activityService = new ActivityService();

  public async createComment(
    cardId: string,
    userId: string,
    input: CreateCommentInput
  ): Promise<CommentResponse> {
    await this.getOwnedCard(cardId, userId);

    const comment = await prisma.$transaction(async (tx) => {
      const nextComment = await tx.comment.create({
        data: {
          cardId,
          content: input.content,
          createdBy: userId,
          updatedBy: userId,
        },
        select: commentSelect,
      });

      await this.activityService.log(
        cardId,
        userId,
        ActivityAction.COMMENT_CREATED,
        {
          commentId: nextComment.id,
          content: nextComment.content,
        } satisfies CommentActivityDetails,
        tx
      );

      return nextComment;
    });

    return comment;
  }

  public async getComments(cardId: string, userId: string): Promise<CommentResponse[]> {
    await this.getOwnedCard(cardId, userId);

    const comments = await prisma.comment.findMany({
      where: {
        cardId,
        isDeleted: false,
      },
      select: commentSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return comments;
  }

  public async getComment(id: string, userId: string): Promise<CommentResponse> {
    const comment = await prisma.comment.findFirst({
      where: {
        id,
        isDeleted: false,
        card: {
          isDeleted: false,
          column: {
            isDeleted: false,
            board: {
              ownerId: userId,
              isDeleted: false,
            },
          },
        },
      },
      select: commentSelect,
    });

    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    return comment;
  }

  public async updateComment(
    id: string,
    userId: string,
    input: UpdateCommentInput
  ): Promise<CommentResponse> {
    // Verify existence & ownership
    await this.getComment(id, userId);

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.comment.update({
        where: { id },
        data: {
          content: input.content,
          updatedBy: userId,
          version: { increment: 1 },
        },
        select: commentSelect,
      });

      await this.activityService.log(
        res.cardId,
        userId,
        ActivityAction.COMMENT_UPDATED,
        {
          commentId: res.id,
          content: res.content,
        } satisfies CommentActivityDetails,
        tx
      );

      return res;
    });

    return updated;
  }

  public async deleteComment(id: string, userId: string): Promise<null> {
    // Verify existence & ownership
    const comment = await this.getComment(id, userId);

    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      await this.activityService.log(
        comment.cardId,
        userId,
        ActivityAction.COMMENT_DELETED,
        {
          commentId: id,
        } satisfies CommentActivityDetails,
        tx
      );
    });

    return null;
  }

  private async getOwnedCard(cardId: string, userId: string): Promise<void> {
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }
  }
}
