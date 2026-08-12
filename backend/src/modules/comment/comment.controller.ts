import { Request, Response, NextFunction } from 'express';
import { CommentService } from './comment.service';
import { AppError } from '../../shared/errors/app-error';

const commentService: CommentService = new CommentService();

export class CommentController {
  public async create(
    req: Request<{ cardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const comment = await commentService.createComment(req.params.cardId, req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: comment,
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
      const comments = await commentService.getComments(req.params.cardId, req.user.id);
      res.status(200).json({
        success: true,
        data: comments,
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
      const comment = await commentService.getComment(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: comment,
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
      const comment = await commentService.updateComment(req.params.id, req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: comment,
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
      await commentService.deleteComment(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}
export default CommentController;
