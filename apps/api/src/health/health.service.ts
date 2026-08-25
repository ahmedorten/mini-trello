import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseHealthDto, HealthResponseDto } from './dto/health-response.dto';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {}

  async check(): Promise<HealthResponseDto> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'up' ? 'ok' : 'error',
      service: 'customer-support-crm-api',
      version: process.env.npm_package_version ?? '0.1.0',
      environment: this.configService.get('NODE_ENV', { infer: true }),
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
      database,
    };
  }

  private async checkDatabase(): Promise<DatabaseHealthDto> {
    const startedAt = process.hrtime.bigint();

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await (this.prisma as any).$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: this.elapsedMs(startedAt) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error({ err: error }, 'Database health probe failed');
      return { status: 'down', latencyMs: this.elapsedMs(startedAt), message };
    }
  }

  private elapsedMs(startedAt: bigint): number {
    return Number((process.hrtime.bigint() - startedAt) / 1000n) / 1000;
  }
}
