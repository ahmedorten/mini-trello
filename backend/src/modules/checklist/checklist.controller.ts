import { Request, Response, NextFunction } from 'express';
import { ChecklistService, ChecklistItemService } from './checklist.service';
import { AppError } from '../../shared/errors/app-error';

const checklistService = new ChecklistService();
const checklistItemService = new ChecklistItemService();

export class ChecklistController {
  // Checklist methods
  public async create(
    req: Request<{ cardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const checklist = await checklistService.createChecklist(
        req.params.cardId,
        req.user.id,
        req.body
      );
      res.status(201).json({
        success: true,
        data: checklist,
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(
    req: Request<{ cardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const checklists = await checklistService.getChecklists(req.params.cardId, req.user.id);
      res.status(200).json({
        success: true,
        data: checklists,
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
      const checklist = await checklistService.getChecklist(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: checklist,
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
      const checklist = await checklistService.updateChecklist(
        req.params.id,
        req.user.id,
        req.body
      );
      res.status(200).json({
        success: true,
        data: checklist,
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
      await checklistService.deleteChecklist(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  // ChecklistItem methods
  public async createItem(
    req: Request<{ checklistId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const item = await checklistItemService.createItem(
        req.params.checklistId,
        req.user.id,
        req.body
      );
      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateItem(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const item = await checklistItemService.updateItem(req.params.id, req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  public async deleteItem(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      await checklistItemService.deleteItem(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}
export default ChecklistController;
