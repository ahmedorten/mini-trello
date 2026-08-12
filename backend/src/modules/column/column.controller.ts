import { Request, Response, NextFunction } from 'express';
import { ColumnService } from './column.service';
import { AppError } from '../../shared/errors/app-error';

const columnService: ColumnService = new ColumnService();

export class ColumnController {
  public async create(
    req: Request<{ boardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const column = await columnService.createColumn(req.params.boardId, req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: column,
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(
    req: Request<{ boardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const columns = await columnService.getColumns(req.params.boardId, req.user.id);
      res.status(200).json({
        success: true,
        data: columns,
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
      const column = await columnService.getColumn(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: column,
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
      const column = await columnService.updateColumn(req.params.id, req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: column,
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
      await columnService.deleteColumn(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}
export default ColumnController;
