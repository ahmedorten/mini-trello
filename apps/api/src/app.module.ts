import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrgModule } from './org/org.module';
import { CustomersModule } from './customers/customers.module';
import { TicketsModule } from './tickets/tickets.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TasksModule } from './tasks/tasks.module';
import { QuickRepliesModule } from './quick-replies/quick-replies.module';
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
            // pino-http does not serialize the request body by default; this is
            // defensive so a future custom serializer cannot leak a password.
            'req.body.password',
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
    PrismaModule,
    AuthModule,
    UsersModule,
    OrgModule,
    CustomersModule,
    TicketsModule,
    DashboardModule,
    TasksModule,
    QuickRepliesModule,
    HealthModule,
  ],
})
export class AppModule {}
