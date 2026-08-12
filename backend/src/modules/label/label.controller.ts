import { Request, Response, NextFunction } from 'express';
import { LabelService } from './label.service';
import { AppError } from '../../shared/errors/app-error';

const labelService: LabelService = new LabelService();

export class LabelController {
  public async create(
    req: Request<{ boardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const label = await labelService.createLabel(req.params.boardId, req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: label,
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
      const labels = await labelService.getLabels(req.params.boardId, req.user.id);
      res.status(200).json({
        success: true,
        data: labels,
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
      const label = await labelService.getLabel(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: label,
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
      const label = await labelService.updateLabel(req.params.id, req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: label,
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
      await labelService.deleteLabel(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}
