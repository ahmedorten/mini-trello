import { Prisma, PrismaClient, ActivityAction } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';

// Strongly typed activity detail interfaces
export interface CardActivityDetails {
  title: string;
}

export interface CardMovedDetails {
  sourceColumnId: string;
  destinationColumnId: string;
  sourcePosition: number;
  destinationPosition: number;
}

export interface CommentActivityDetails {
  commentId: string;
  content?: string;
}

export interface LabelActivityDetails {
  labelId: string;
  name: string;
  color: string;
}

export interface ChecklistCreatedDetails {
  checklistId: string;
  title: string;
}

export interface ChecklistUpdatedDetails {
  checklistId: string;
  title: string;
}

export interface ChecklistDeletedDetails {
  checklistId: string;
  title: string;
}

export interface ChecklistItemCreatedDetails {
  checklistId: string;
  itemId: string;
  title: string;
}

export interface ChecklistItemCompletedDetails {
  checklistId: string;
  itemId: string;
  title: string;
}

export interface ChecklistItemDeletedDetails {
  checklistId: string;
  itemId: string;
  title: string;
}

export interface AttachmentAddedDetails {
  attachmentId: string;
  fileName: string;
  mimetype: string | null;
  fileSize: number | null;
}

export interface AttachmentUpdatedDetails {
  attachmentId: string;
  oldFileName: string;
  newFileName: string;
}

export interface AttachmentDeletedDetails {
  attachmentId: string;
  fileName: string;
}

export interface ActivityResponse {
  id: string;
  cardId: string;
  action: ActivityAction;
  details: Prisma.JsonValue | null;
  createdAt: Date;
  createdBy: string | null;
}

const activitySelect = {
  id: true,
  cardId: true,
  action: true,
  details: true,
  createdAt: true,
  createdBy: true,
};

export class ActivityService {
  public async log(
    cardId: string,
    userId: string,
    action: ActivityAction,
    details?: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient | PrismaClient = prisma
  ): Promise<void> {
    await tx.activity.create({
      data: {
        cardId,
        createdBy: userId,
        action,
        details: details ?? undefined,
      },
    });
  }

  public async getActivities(cardId: string, userId: string): Promise<ActivityResponse[]> {
    await this.getOwnedCard(cardId, userId);

    const activities = await prisma.activity.findMany({
      where: {
        cardId,
      },
      select: activitySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return activities;
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
