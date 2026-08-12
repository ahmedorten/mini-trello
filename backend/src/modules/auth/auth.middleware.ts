import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config';
import { AppError } from '../../shared/errors/app-error';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader: string | undefined = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401));
  }

  const token: string = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
    req.user = {
      id: decoded.id,
      email: decoded.email,
    };
    next();
  } catch {
    next(new AppError('Unauthorized', 401));
  }
}

export default authMiddleware;
