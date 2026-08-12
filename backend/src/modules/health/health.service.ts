import prisma from '../../shared/database/prisma';
import logger from '../../shared/utils/logger';

export async function checkDatabaseHealth(): Promise<'connected' | 'disconnected'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch (error) {
    logger.error({ error }, 'Database connection health check failed');
    return 'disconnected';
  }
}
