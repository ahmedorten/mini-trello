import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthResponseDto } from './dto/health-response.dto';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'customer-support-crm-api',
      version: process.env.npm_package_version ?? '0.1.0',
      environment: this.configService.get('NODE_ENV', { infer: true }),
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
    };
  }
}
