import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';
import { CreateColumnInput, UpdateColumnInput } from './column.schema';

export interface ColumnResponse {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const columnSelect = {
  id: true,
  boardId: true,
  name: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  version: true,
};

export class ColumnService {
  public async createColumn(
    boardId: string,
    userId: string,
    input: CreateColumnInput
  ): Promise<ColumnResponse> {
    await this.getOwnedBoard(boardId, userId);

    const positionAggregate = await prisma.column.aggregate({
      where: {
        boardId,
        isDeleted: false,
      },
      _max: {
        position: true,
      },
    });

    const maxPosition = positionAggregate._max.position;
    const nextPosition = maxPosition !== null ? maxPosition + 1 : 0;

    const column = await prisma.column.create({
      data: {
        boardId,
        name: input.name,
        position: nextPosition,
        createdBy: userId,
        updatedBy: userId,
      },
      select: columnSelect,
    });

    return column;
  }

  public async getColumns(boardId: string, userId: string): Promise<ColumnResponse[]> {
    await this.getOwnedBoard(boardId, userId);

    const columns = await prisma.column.findMany({
      where: {
        boardId,
        isDeleted: false,
      },
      select: columnSelect,
      orderBy: [
        {
          position: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return columns;
  }

  public async getColumn(id: string, userId: string): Promise<ColumnResponse> {
    const column = await prisma.column.findFirst({
      where: {
        id,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
      select: columnSelect,
    });

    if (!column) {
      throw new AppError('Column not found', 404);
    }

    return column;
  }

  public async updateColumn(
    id: string,
    userId: string,
    input: UpdateColumnInput
  ): Promise<ColumnResponse> {
    const existing = await prisma.column.findFirst({
      where: {
        id,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Column not found', 404);
    }

    const updated = await prisma.column.update({
      where: { id },
      data: {
        ...input,
        updatedBy: userId,
        version: { increment: 1 },
      },
      select: columnSelect,
    });

    return updated;
  }

  public async deleteColumn(id: string, userId: string): Promise<null> {
    const existing = await prisma.column.findFirst({
      where: {
        id,
        isDeleted: false,
        board: {
          ownerId: userId,
          isDeleted: false,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Column not found', 404);
    }

    await prisma.column.update({
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

  private async getOwnedBoard(boardId: string, userId: string): Promise<void> {
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        ownerId: userId,
        isDeleted: false,
      },
      select: {
        id: true,
      },
    });

    if (!board) {
      throw new AppError('Board not found', 404);
    }
  }
}
