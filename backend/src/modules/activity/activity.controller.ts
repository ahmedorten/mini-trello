import { Request, Response, NextFunction } from 'express';
import { ActivityService } from './activity.service';
import { AppError } from '../../shared/errors/app-error';

const activityService = new ActivityService();

export class ActivityController {
  public async list(
    req: Request<{ cardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const activities = await activityService.getActivities(req.params.cardId, req.user.id);
      res.status(200).json({
        success: true,
        data: activities,
      });
    } catch (error) {
      next(error);
    }
  }
}
export default ActivityController;
