import { Request, Response, NextFunction } from 'express';
import { BoardService } from './board.service';
import { BoardSearchInput } from './board-search.schema';
import { AppError } from '../../shared/errors/app-error';

const boardService: BoardService = new BoardService();

export class BoardController {
  public async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const result = await boardService.searchBoards(
        req.user.id,
        req.query as unknown as BoardSearchInput
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const board = await boardService.createBoard(req.body, req.user.id);
      res.status(201).json({
        success: true,
        data: board,
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const boards = await boardService.getBoards(req.user.id);
      res.status(200).json({
        success: true,
        data: boards,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const board = await boardService.getBoard(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: board,
      });
    } catch (error) {
      next(error);
    }
  }

  public async update(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const board = await boardService.updateBoard(req.params.id, req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: board,
      });
    } catch (error) {
      next(error);
    }
  }

  public async delete(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      await boardService.deleteBoard(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}
