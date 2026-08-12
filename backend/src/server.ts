import app from './app';
import config from './config';
import logger from './shared/utils/logger';

const server = app.listen(config.port, () => {
  logger.info(`🚀 Server running in ${config.nodeEnv} mode on port ${config.port}`);
});

const gracefulShutdown = (signal: string): void => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if active connections hang
  setTimeout(() => {
    logger.error('Forced shutdown due to active connections.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
