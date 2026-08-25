import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),

    LoggerModule.forRoot({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      pinoHttp: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        level: (process.env.LOG_LEVEL ?? 'info') as any,
        genReqId: (req: IncomingMessage) => (req.headers['x-request-id'] as string) ?? randomUUID(),
        autoLogging: {
          ignore: (req: IncomingMessage) => req.url === '/api/health',
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'res.headers["set-cookie"]',
          ],
          censor: '[redacted]',
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              }
            : undefined,
      } as any,
    }),
    HealthModule,
  ],
})
export class AppModule {}
