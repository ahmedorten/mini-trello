import { Request, Response } from 'express';
import config from '../../config';
import { checkDatabaseHealth } from './health.service';

export class HealthController {
  public async getHealth(_req: Request, res: Response): Promise<void> {
    const dbStatus: 'connected' | 'disconnected' = await checkDatabaseHealth();

    res.status(200).json({
      success: true,
      message: 'API is running',
      data: {
        version: '1.0.0',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        database: dbStatus,
      },
    });
  }
}
