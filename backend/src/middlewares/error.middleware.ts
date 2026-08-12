import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/app-error';
import logger from '../shared/utils/logger';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode: number = 500;
  let message: string = 'Internal server error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
  } else {
    logger.error(
      {
        err,
        method: req.method,
        url: req.originalUrl,
      },
      'Unhandled application error'
    );
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

export default errorMiddleware;
