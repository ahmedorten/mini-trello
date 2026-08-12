import { ActivityAction } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';
import {
  CreateChecklistInput,
  UpdateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from './checklist.schema';
import {
  ActivityService,
  ChecklistCreatedDetails,
  ChecklistUpdatedDetails,
  ChecklistDeletedDetails,
  ChecklistItemCreatedDetails,
  ChecklistItemCompletedDetails,
  ChecklistItemDeletedDetails,
} from '../activity/activity.service';

export interface ChecklistItemResponse {
  id: string;
  checklistId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface ChecklistResponse {
  id: string;
  cardId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  checklistItems: ChecklistItemResponse[];
}

const checklistItemSelect = {
  id: true,
  checklistId: true,
  title: true,
  isCompleted: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  version: true,
};

const checklistSelect = {
  id: true,
  cardId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  checklistItems: {
    where: { isDeleted: false },
    select: checklistItemSelect,
    orderBy: [{ position: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
};

export class ChecklistService {
  private readonly activityService = new ActivityService();

  public async createChecklist(
    cardId: string,
    userId: string,
    input: CreateChecklistInput
  ): Promise<ChecklistResponse> {
    await this.getOwnedCard(cardId, userId);

    const checklist = await prisma.$transaction(async (tx) => {
      const nextChecklist = await tx.checklist.create({
        data: {
          cardId,
          title: input.title,
          createdBy: userId,
          updatedBy: userId,
        },
        select: checklistSelect,
      });

      await this.activityService.log(
        cardId,
        userId,
        ActivityAction.CHECKLIST_CREATED,
        {
          checklistId: nextChecklist.id,
          title: nextChecklist.title,
        } satisfies ChecklistCreatedDetails,
        tx
      );

      return nextChecklist;
    });

    return checklist;
  }

  public async getChecklists(cardId: string, userId: string): Promise<ChecklistResponse[]> {
    await this.getOwnedCard(cardId, userId);

    const checklists = await prisma.checklist.findMany({
      where: {
        cardId,
        isDeleted: false,
      },
      select: checklistSelect,
      orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    });

    return checklists;
  }

  public async getChecklist(id: string, userId: string): Promise<ChecklistResponse> {
    const checklist = await prisma.checklist.findFirst({
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
      select: checklistSelect,
    });

    if (!checklist) {
      throw new AppError('Checklist not found', 404);
    }

    return checklist;
  }

  public async updateChecklist(
    id: string,
    userId: string,
    input: UpdateChecklistInput
  ): Promise<ChecklistResponse> {
    await this.getChecklist(id, userId);

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.checklist.update({
        where: { id },
        data: {
          title: input.title,
          updatedBy: userId,
          version: { increment: 1 },
        },
        select: checklistSelect,
      });

      await this.activityService.log(
        res.cardId,
        userId,
        ActivityAction.CHECKLIST_UPDATED,
        {
          checklistId: res.id,
          title: res.title,
        } satisfies ChecklistUpdatedDetails,
        tx
      );

      return res;
    });

    return updated;
  }

  public async deleteChecklist(id: string, userId: string): Promise<null> {
    const checklist = await this.getChecklist(id, userId);

    await prisma.$transaction(async (tx) => {
      // 1. Cascade soft-delete ChecklistItems with full audit updates and version increments
      await tx.checklistItem.updateMany({
        where: {
          checklistId: id,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      // 2. Soft-delete the Checklist itself
      await tx.checklist.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      // 3. Log checklist deleted activity
      await this.activityService.log(
        checklist.cardId,
        userId,
        ActivityAction.CHECKLIST_DELETED,
        {
          checklistId: id,
          title: checklist.title,
        } satisfies ChecklistDeletedDetails,
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

export class ChecklistItemService {
  private readonly activityService = new ActivityService();

  public async createItem(
    checklistId: string,
    userId: string,
    input: CreateChecklistItemInput
  ): Promise<ChecklistItemResponse> {
    const checklist = await this.getOwnedChecklist(checklistId, userId);

    const item = await prisma.$transaction(async (tx) => {
      const positionAggregate = await tx.checklistItem.aggregate({
        where: {
          checklistId,
          isDeleted: false,
        },
        _max: {
          position: true,
        },
      });

      const maxPosition = positionAggregate._max.position;
      const nextPosition = maxPosition !== null ? maxPosition + 1 : 0;

      const nextItem = await tx.checklistItem.create({
        data: {
          checklistId,
          title: input.title,
          position: nextPosition,
          createdBy: userId,
          updatedBy: userId,
        },
        select: checklistItemSelect,
      });

      await this.activityService.log(
        checklist.cardId,
        userId,
        ActivityAction.CHECKLIST_ITEM_CREATED,
        {
          checklistId,
          itemId: nextItem.id,
          title: nextItem.title,
        } satisfies ChecklistItemCreatedDetails,
        tx
      );

      return nextItem;
    });

    return item;
  }

  public async updateItem(
    id: string,
    userId: string,
    input: UpdateChecklistItemInput
  ): Promise<ChecklistItemResponse> {
    const existing = await this.getOwnedItem(id, userId);

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.checklistItem.update({
        where: { id },
        data: {
          ...input,
          updatedBy: userId,
          version: { increment: 1 },
        },
        select: checklistItemSelect,
      });

      if (input.isCompleted !== undefined && input.isCompleted !== existing.isCompleted) {
        const action = res.isCompleted
          ? ActivityAction.CHECKLIST_ITEM_COMPLETED
          : ActivityAction.CHECKLIST_ITEM_UNCOMPLETED;

        await this.activityService.log(
          existing.checklist.cardId,
          userId,
          action,
          {
            checklistId: existing.checklistId,
            itemId: id,
            title: res.title,
          } satisfies ChecklistItemCompletedDetails,
          tx
        );
      }

      return res;
    });

    return updated;
  }

  public async deleteItem(id: string, userId: string): Promise<null> {
    const existing = await this.getOwnedItem(id, userId);

    await prisma.$transaction(async (tx) => {
      // 1. Shift positions of subsequent items to close the gap
      await tx.checklistItem.updateMany({
        where: {
          checklistId: existing.checklistId,
          isDeleted: false,
          position: { gt: existing.position },
        },
        data: {
          position: { decrement: 1 },
        },
      });

      // 2. Soft delete the item
      await tx.checklistItem.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      // 3. Log item deleted activity
      await this.activityService.log(
        existing.checklist.cardId,
        userId,
        ActivityAction.CHECKLIST_ITEM_DELETED,
        {
          checklistId: existing.checklistId,
          itemId: id,
          title: existing.title,
        } satisfies ChecklistItemDeletedDetails,
        tx
      );
    });

    return null;
  }

  private async getOwnedChecklist(
    checklistId: string,
    userId: string
  ): Promise<{ id: string; cardId: string }> {
    const checklist = await prisma.checklist.findFirst({
      where: {
        id: checklistId,
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
      select: {
        id: true,
        cardId: true,
      },
    });

    if (!checklist) {
      throw new AppError('Checklist not found', 404);
    }

    return checklist;
  }

  private async getOwnedItem(
    id: string,
    userId: string
  ): Promise<{
    id: string;
    checklistId: string;
    title: string;
    isCompleted: boolean;
    position: number;
    checklist: { cardId: string };
  }> {
    const item = await prisma.checklistItem.findFirst({
      where: {
        id,
        isDeleted: false,
        checklist: {
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
      },
      select: {
        id: true,
        checklistId: true,
        title: true,
        isCompleted: true,
        position: true,
        checklist: {
          select: {
            cardId: true,
          },
        },
      },
    });

    if (!item) {
      throw new AppError('Checklist item not found', 404);
    }

    return item;
  }
}
