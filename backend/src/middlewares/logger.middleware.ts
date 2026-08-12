import { Request, Response, NextFunction } from 'express';
import logger from '../shared/utils/logger';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime: number = Date.now();

  res.on('finish', () => {
    const duration: number = Date.now() - startTime;
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      },
      'HTTP Request completed'
    );
  });

  next();
}

export default loggerMiddleware;
//
