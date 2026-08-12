import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error';

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
}

export default notFoundMiddleware;
