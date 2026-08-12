import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';
import { CreateLabelInput, UpdateLabelInput } from './label.schema';
import { ActivityService, LabelActivityDetails } from '../activity/activity.service';
import { ActivityAction } from '@prisma/client';

export interface LabelResponse {
  id: string;
  boardId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class LabelService {
  private readonly activityService = new ActivityService();
  public async createLabel(
    boardId: string,
    userId: string,
    input: CreateLabelInput
  ): Promise<LabelResponse> {
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        isDeleted: false,
        ownerId: userId,
      },
    });

    if (!board) {
      throw new AppError('Board not found', 404);
    }

    const label = await prisma.label.create({
      data: {
        boardId,
        name: input.name,
        color: input.color,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    return this.toResponse(label);
  }

  public async getLabels(boardId: string, userId: string): Promise<LabelResponse[]> {
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        isDeleted: false,
        ownerId: userId,
      },
    });

    if (!board) {
      throw new AppError('Board not found', 404);
    }

    const labels = await prisma.label.findMany({
      where: {
        boardId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return labels.map((l) => this.toResponse(l));
  }

  public async getLabel(id: string, userId: string): Promise<LabelResponse> {
    const label = await prisma.label.findFirst({
      where: {
        id,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
    });

    if (!label) {
      throw new AppError('Label not found', 404);
    }

    return this.toResponse(label);
  }

  public async updateLabel(
    id: string,
    userId: string,
    input: UpdateLabelInput
  ): Promise<LabelResponse> {
    const label = await prisma.label.findFirst({
      where: {
        id,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
    });

    if (!label) {
      throw new AppError('Label not found', 404);
    }

    const updated = await prisma.label.update({
      where: { id },
      data: {
        ...input,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    return this.toResponse(updated);
  }

  public async deleteLabel(id: string, userId: string): Promise<null> {
    const label = await prisma.label.findFirst({
      where: {
        id,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
    });

    if (!label) {
      throw new AppError('Label not found', 404);
    }

    await prisma.label.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    return null;
  }

  public async attachLabel(cardId: string, labelId: string, userId: string): Promise<null> {
    // 1. Fetch card and verify ownership
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
        column: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    // 2. Fetch label and verify ownership
    const label = await prisma.label.findFirst({
      where: {
        id: labelId,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
      select: {
        id: true,
        boardId: true,
        name: true,
        color: true,
      },
    });

    if (!label) {
      throw new AppError('Label not found', 404);
    }

    // 3. Verify cross-board constraint
    if (card.column.boardId !== label.boardId) {
      throw new AppError('Label and card must belong to the same board', 400);
    }

    // 4. Verify duplicate constraint
    const exists = await prisma.cardLabel.findUnique({
      where: {
        cardId_labelId: {
          cardId,
          labelId,
        },
      },
    });

    if (exists) {
      throw new AppError('Label is already attached to this card', 400);
    }

    // 5. Create explicit join record and log activity atomically
    await prisma.$transaction(async (tx) => {
      await tx.cardLabel.create({
        data: {
          cardId,
          labelId,
          createdBy: userId,
        },
      });

      await this.activityService.log(
        cardId,
        userId,
        ActivityAction.LABEL_ATTACHED,
        {
          labelId: label.id,
          name: label.name,
          color: label.color,
        } satisfies LabelActivityDetails,
        tx
      );
    });

    return null;
  }

  public async detachLabel(cardId: string, labelId: string, userId: string): Promise<null> {
    // 1. Fetch card and verify ownership
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
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    // 2. Fetch label and verify ownership
    const label = await prisma.label.findFirst({
      where: {
        id: labelId,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
    });

    if (!label) {
      throw new AppError('Label not found', 404);
    }

    // 3. Verify relation exists
    const exists = await prisma.cardLabel.findUnique({
      where: {
        cardId_labelId: {
          cardId,
          labelId,
        },
      },
    });

    if (!exists) {
      throw new AppError('Label is not attached to this card', 400);
    }

    // 4. Delete explicit join record and log activity atomically
    await prisma.$transaction(async (tx) => {
      await tx.cardLabel.delete({
        where: {
          cardId_labelId: {
            cardId,
            labelId,
          },
        },
      });

      await this.activityService.log(
        cardId,
        userId,
        ActivityAction.LABEL_DETACHED,
        {
          labelId: label.id,
          name: label.name,
          color: label.color,
        } satisfies LabelActivityDetails,
        tx
      );
    });

    return null;
  }

  private toResponse(label: {
    id: string;
    boardId: string;
    name: string;
    color: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): LabelResponse {
    return {
      id: label.id,
      boardId: label.boardId,
      name: label.name,
      color: label.color,
      createdAt: label.createdAt,
      updatedAt: label.updatedAt,
      version: label.version,
    };
  }
}
