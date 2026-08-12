import { CardPriority, ActivityAction, Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';
import { CreateCardInput, UpdateCardInput, MoveCardInput } from './card.schema';
import { CardSearchInput } from './card-search.schema';
import { PaginatedResponse } from '../../shared/types/pagination';
import {
  ActivityService,
  CardActivityDetails,
  CardMovedDetails,
} from '../activity/activity.service';

export interface CardResponse {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: Date | null;
  priority: CardPriority;
  isArchived: boolean;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  labels: {
    id: string;
    name: string;
    color: string;
  }[];
  checklistsCount: number;
  completedItems: number;
  totalItems: number;
  progress: number;
  attachmentsCount: number;
}

const cardSelect = {
  id: true,
  columnId: true,
  title: true,
  description: true,
  position: true,
  dueDate: true,
  priority: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  column: {
    select: {
      boardId: true,
    },
  },
  cardLabels: {
    where: {
      label: {
        isDeleted: false,
      },
    },
    select: {
      label: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  },
  checklists: {
    where: { isDeleted: false },
    select: {
      id: true,
      _count: {
        select: {
          checklistItems: {
            where: { isDeleted: false },
          },
        },
      },
      checklistItems: {
        where: { isDeleted: false, isCompleted: true },
        select: {
          id: true,
        },
      },
    },
  },
  _count: {
    select: {
      comments: {
        where: {
          isDeleted: false,
        },
      },
      checklists: {
        where: {
          isDeleted: false,
        },
      },
      attachments: {
        where: {
          isDeleted: false,
        },
      },
    },
  },
};

export class CardService {
  private readonly activityService = new ActivityService();

  public async searchCards(
    userId: string,
    filters: CardSearchInput
  ): Promise<PaginatedResponse<CardResponse>> {
    // Search is a read-only operation and must never create Activity records.
    const {
      q,
      boardId,
      columnId,
      priority,
      labelId,
      hasAttachments,
      hasComments,
      hasChecklist,
      dueBefore,
      dueAfter,
      isArchived,
      sort,
      direction,
      page,
      pageSize,
    } = filters;

    const where: Prisma.CardWhereInput = {
      isDeleted: false,
      column: {
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
    };

    // Filters
    if (boardId) {
      where.column = {
        isDeleted: false,
        boardId: boardId,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      };
    }

    if (columnId) {
      where.columnId = columnId;
    }

    if (priority) {
      where.priority = priority;
    }

    if (isArchived !== undefined) {
      where.isArchived = isArchived;
    } else {
      // Archived cards remain hidden by default unless explicitly requested.
      where.isArchived = false;
    }

    if (labelId) {
      where.cardLabels = {
        some: {
          labelId: labelId,
          label: {
            isDeleted: false,
          },
        },
      };
    }

    if (hasAttachments !== undefined) {
      if (hasAttachments) {
        where.attachments = {
          some: {
            isDeleted: false,
          },
        };
      } else {
        where.attachments = {
          none: {
            isDeleted: false,
          },
        };
      }
    }

    if (hasComments !== undefined) {
      if (hasComments) {
        where.comments = {
          some: {
            isDeleted: false,
          },
        };
      } else {
        where.comments = {
          none: {
            isDeleted: false,
          },
        };
      }
    }

    if (hasChecklist !== undefined) {
      if (hasChecklist) {
        where.checklists = {
          some: {
            isDeleted: false,
          },
        };
      } else {
        where.checklists = {
          none: {
            isDeleted: false,
          },
        };
      }
    }

    if (dueBefore || dueAfter) {
      where.dueDate = {};
      if (dueBefore) {
        where.dueDate.lte = dueBefore;
      }
      if (dueAfter) {
        where.dueDate.gte = dueAfter;
      }
    }

    // Search rules
    if (q) {
      where.OR = [
        {
          title: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          cardLabels: {
            some: {
              label: {
                name: {
                  contains: q,
                  mode: 'insensitive',
                },
                isDeleted: false,
              },
            },
          },
        },
        {
          comments: {
            some: {
              content: {
                contains: q,
                mode: 'insensitive',
              },
              isDeleted: false,
            },
          },
        },
      ];
    }

    const sortField = sort || 'createdAt';
    const sortDirection = direction || 'desc';

    const [total, items] = await Promise.all([
      prisma.card.count({ where }),
      prisma.card.findMany({
        where,
        select: cardSelect,
        orderBy: [
          { [sortField]: sortDirection },
          { id: 'asc' }, // deterministic ordering
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((c) => this.formatCard(c)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public async createCard(
    columnId: string,
    userId: string,
    input: CreateCardInput
  ): Promise<CardResponse> {
    await this.getOwnedColumn(columnId, userId);

    const positionAggregate = await prisma.card.aggregate({
      where: {
        columnId,
        isDeleted: false,
      },
      _max: {
        position: true,
      },
    });

    const maxPosition = positionAggregate._max.position;
    const nextPosition = maxPosition !== null ? maxPosition + 1 : 0;

    const card = await prisma.$transaction(async (tx) => {
      const nextCard = await tx.card.create({
        data: {
          columnId,
          title: input.title,
          description: input.description ?? null,
          position: nextPosition,
          dueDate: input.dueDate ?? null,
          priority: input.priority ?? CardPriority.MEDIUM,
          isArchived: false,
          createdBy: userId,
          updatedBy: userId,
        },
        select: cardSelect,
      });

      await this.activityService.log(
        nextCard.id,
        userId,
        ActivityAction.CARD_CREATED,
        { title: nextCard.title } satisfies CardActivityDetails,
        tx
      );

      return nextCard;
    });

    return this.formatCard(card);
  }

  public async getCards(columnId: string, userId: string): Promise<CardResponse[]> {
    await this.getOwnedColumn(columnId, userId);

    const cards = await prisma.card.findMany({
      where: {
        columnId,
        isDeleted: false,
        isArchived: false,
      },
      select: cardSelect,
      orderBy: [
        {
          position: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return cards.map((c) => this.formatCard(c));
  }

  public async getCard(id: string, userId: string): Promise<CardResponse> {
    const card = await prisma.card.findFirst({
      where: {
        id,
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
      select: cardSelect,
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    return this.formatCard(card);
  }

  public async updateCard(
    id: string,
    userId: string,
    input: UpdateCardInput
  ): Promise<CardResponse> {
    const existing = await prisma.card.findFirst({
      where: {
        id,
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
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        isArchived: true,
      },
    });

    if (!existing) {
      throw new AppError('Card not found', 404);
    }

    const titleChanged = input.title !== undefined && input.title !== existing.title;
    const descriptionChanged =
      input.description !== undefined && input.description !== existing.description;
    const dueDateChanged =
      input.dueDate !== undefined &&
      ((input.dueDate === null && existing.dueDate !== null) ||
        (input.dueDate !== null && existing.dueDate === null) ||
        (input.dueDate !== null &&
          existing.dueDate !== null &&
          new Date(input.dueDate).getTime() !== new Date(existing.dueDate).getTime()));
    const priorityChanged = input.priority !== undefined && input.priority !== existing.priority;

    const hasUpdatedFieldsChanged =
      titleChanged || descriptionChanged || dueDateChanged || priorityChanged;
    const archiveChanged =
      input.isArchived !== undefined && input.isArchived !== existing.isArchived;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.card.update({
        where: { id },
        data: {
          ...input,
          updatedBy: userId,
          version: { increment: 1 },
        },
        select: cardSelect,
      });

      if (archiveChanged) {
        const action = res.isArchived
          ? ActivityAction.CARD_ARCHIVED
          : ActivityAction.CARD_UNARCHIVED;
        await this.activityService.log(
          id,
          userId,
          action,
          { title: res.title } satisfies CardActivityDetails,
          tx
        );
      }

      if (hasUpdatedFieldsChanged) {
        await this.activityService.log(
          id,
          userId,
          ActivityAction.CARD_UPDATED,
          { title: res.title } satisfies CardActivityDetails,
          tx
        );
      }

      return res;
    });

    return this.formatCard(updated);
  }

  public async deleteCard(id: string, userId: string): Promise<null> {
    const existing = await prisma.card.findFirst({
      where: {
        id,
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
      select: { id: true, columnId: true, position: true },
    });

    if (!existing) {
      throw new AppError('Card not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      // Step 1: Close the gap
      await tx.card.updateMany({
        where: {
          columnId: existing.columnId,
          isDeleted: false,
          position: { gt: existing.position },
        },
        data: {
          position: { decrement: 1 },
        },
      });

      // Step 2: Soft delete the card
      await tx.card.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      // Step 3: Cascade soft-delete attachments
      await tx.attachment.updateMany({
        where: {
          cardId: id,
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

      await this.activityService.log(id, userId, ActivityAction.CARD_DELETED, undefined, tx);
    });

    return null;
  }

  public async moveCard(id: string, userId: string, input: MoveCardInput): Promise<CardResponse> {
    // 1. Fetch card & check ownership
    const card = await prisma.card.findFirst({
      where: {
        id,
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
        columnId: true,
        position: true,
      },
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    // 2. Fetch destination column & check ownership
    const destinationColumn = await prisma.column.findFirst({
      where: {
        id: input.destinationColumnId,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
      select: {
        id: true,
      },
    });

    if (!destinationColumn) {
      throw new AppError('Column not found', 404);
    }

    // 3. Count cards in destination column to determine max destination position
    const totalCards = await prisma.card.count({
      where: {
        columnId: input.destinationColumnId,
        isDeleted: false,
      },
    });

    // 4. Resolve effective position
    const isSameColumn = card.columnId === input.destinationColumnId;
    const maxAllowed = isSameColumn ? totalCards - 1 : totalCards;

    let effectiveDestPos = maxAllowed;
    if (input.destinationPosition !== undefined && input.destinationPosition < maxAllowed) {
      effectiveDestPos = input.destinationPosition;
    }

    // 5. No-op guard
    if (isSameColumn && effectiveDestPos === card.position) {
      const currentCard = await this.getCard(id, userId);
      return currentCard;
    }

    // 6. Execute reordering transaction
    const updatedCard = await prisma.$transaction(async (tx) => {
      if (isSameColumn) {
        // Shift intermediate cards first
        if (effectiveDestPos > card.position) {
          // Moving down: decrement positions between source (excl) and dest (incl)
          await tx.card.updateMany({
            where: {
              columnId: card.columnId,
              isDeleted: false,
              position: {
                gt: card.position,
                lte: effectiveDestPos,
              },
            },
            data: {
              position: { decrement: 1 },
            },
          });
        } else {
          // Moving up: increment positions between dest (incl) and source (excl)
          await tx.card.updateMany({
            where: {
              columnId: card.columnId,
              isDeleted: false,
              position: {
                gte: effectiveDestPos,
                lt: card.position,
              },
            },
            data: {
              position: { increment: 1 },
            },
          });
        }

        // Update the card itself
        const updated = await tx.card.update({
          where: { id },
          data: {
            position: effectiveDestPos,
            updatedBy: userId,
            version: { increment: 1 },
          },
          select: cardSelect,
        });

        await this.activityService.log(
          id,
          userId,
          ActivityAction.CARD_MOVED,
          {
            sourceColumnId: card.columnId,
            destinationColumnId: input.destinationColumnId,
            sourcePosition: card.position,
            destinationPosition: effectiveDestPos,
          } satisfies CardMovedDetails,
          tx
        );

        return updated;
      } else {
        // Cross-column move
        // Step 1: Close source gap
        await tx.card.updateMany({
          where: {
            columnId: card.columnId,
            isDeleted: false,
            position: {
              gt: card.position,
            },
          },
          data: {
            position: { decrement: 1 },
          },
        });

        // Step 2: Open destination slot
        await tx.card.updateMany({
          where: {
            columnId: input.destinationColumnId,
            isDeleted: false,
            position: {
              gte: effectiveDestPos,
            },
          },
          data: {
            position: { increment: 1 },
          },
        });

        // Step 3: Move the card to new column & position
        const updated = await tx.card.update({
          where: { id },
          data: {
            columnId: input.destinationColumnId,
            position: effectiveDestPos,
            updatedBy: userId,
            version: { increment: 1 },
          },
          select: cardSelect,
        });

        await this.activityService.log(
          id,
          userId,
          ActivityAction.CARD_MOVED,
          {
            sourceColumnId: card.columnId,
            destinationColumnId: input.destinationColumnId,
            sourcePosition: card.position,
            destinationPosition: effectiveDestPos,
          } satisfies CardMovedDetails,
          tx
        );

        return updated;
      }
    });

    return this.formatCard(updatedCard);
  }

  private async getOwnedColumn(columnId: string, userId: string): Promise<void> {
    const column = await prisma.column.findFirst({
      where: {
        id: columnId,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
      select: {
        id: true,
      },
    });

    if (!column) {
      throw new AppError('Column not found', 404);
    }
  }

  private formatCard(card: {
    id: string;
    columnId: string;
    title: string;
    description: string | null;
    position: number;
    dueDate: Date | null;
    priority: CardPriority;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    column?: {
      boardId: string;
    };
    cardLabels?: {
      label: {
        id: string;
        name: string;
        color: string;
      };
    }[];
    checklists?: {
      id: string;
      _count: {
        checklistItems: number;
      };
      checklistItems: {
        id: string;
      }[];
    }[];
    _count?: {
      comments: number;
      checklists: number;
      attachments: number;
    };
  }): CardResponse {
    const checklists = card.checklists ?? [];
    const checklistsCount = card._count?.checklists ?? checklists.length;
    let totalItems = 0;
    let completedItems = 0;

    for (const cl of checklists) {
      totalItems += cl._count?.checklistItems ?? 0;
      completedItems += cl.checklistItems?.length ?? 0;
    }

    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return {
      id: card.id,
      columnId: card.columnId,
      boardId: card.column?.boardId || '',
      title: card.title,
      description: card.description,
      position: card.position,
      dueDate: card.dueDate,
      priority: card.priority,
      isArchived: card.isArchived,
      commentsCount: card._count?.comments ?? 0,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      version: card.version,
      labels: card.cardLabels ? card.cardLabels.map((cl) => cl.label) : [],
      checklistsCount,
      completedItems,
      totalItems,
      progress,
      attachmentsCount: card._count?.attachments ?? 0,
    };
  }
}
