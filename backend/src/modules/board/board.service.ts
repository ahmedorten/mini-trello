import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';
import { CreateBoardInput, UpdateBoardInput } from './board.schema';
import { BoardSearchInput } from './board-search.schema';
import { PaginatedResponse } from '../../shared/types/pagination';

export interface BoardResponse {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const boardSelect = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
};

export class BoardService {
  public async createBoard(input: CreateBoardInput, userId: string): Promise<BoardResponse> {
    const board = await prisma.board.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId: userId,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    return this.toResponse(board);
  }

  public async searchBoards(
    userId: string,
    filters: BoardSearchInput
  ): Promise<PaginatedResponse<BoardResponse>> {
    // Search is a read-only operation and must never create Activity records.
    const { q, page, pageSize, sort, direction } = filters;

    const where: Prisma.BoardWhereInput = {
      ownerId: userId,
      isDeleted: false,
    };

    if (q) {
      where.OR = [
        {
          name: {
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
      ];
    }

    const [total, items] = await Promise.all([
      prisma.board.count({ where }),
      prisma.board.findMany({
        where,
        select: boardSelect,
        orderBy: [
          { [sort]: direction },
          { id: 'asc' }, // deterministic ordering
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public async getBoards(userId: string): Promise<BoardResponse[]> {
    const boards = await prisma.board.findMany({
      where: {
        ownerId: userId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return boards.map(this.toResponse);
  }

  public async getBoard(id: string, userId: string): Promise<BoardResponse> {
    const board = await prisma.board.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!board) {
      throw new AppError('Board not found', 404);
    }

    if (board.ownerId !== userId) {
      throw new AppError('Forbidden', 403);
    }

    return this.toResponse(board);
  }

  public async updateBoard(
    id: string,
    userId: string,
    input: UpdateBoardInput
  ): Promise<BoardResponse> {
    const board = await prisma.board.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!board) {
      throw new AppError('Board not found', 404);
    }

    if (board.ownerId !== userId) {
      throw new AppError('Forbidden', 403);
    }

    const updated = await prisma.board.update({
      where: { id },
      data: {
        ...input,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    return this.toResponse(updated);
  }

  public async deleteBoard(id: string, userId: string): Promise<null> {
    const board = await prisma.board.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!board) {
      throw new AppError('Board not found', 404);
    }

    if (board.ownerId !== userId) {
      throw new AppError('Forbidden', 403);
    }

    await prisma.board.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return null;
  }

  private toResponse(board: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): BoardResponse {
    return {
      id: board.id,
      name: board.name,
      description: board.description,
      ownerId: board.ownerId,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      version: board.version,
    };
  }
}
