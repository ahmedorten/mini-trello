import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { AppError } from '../../shared/errors/app-error';

const dashboardService = new DashboardService();

export class DashboardController {
  public async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const data = await dashboardService.getDashboard(req.user.id);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
export default DashboardController;
