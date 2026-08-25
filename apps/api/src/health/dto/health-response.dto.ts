import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ example: 'customer-support-crm-api' })
  service!: string;

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({ example: 'development' })
  environment!: string;

  @ApiProperty({ example: 12.34, description: 'Process uptime in seconds.' })
  uptimeSeconds!: number;

  @ApiProperty({ example: '2026-08-25T07:10:11.113Z', format: 'date-time' })
  timestamp!: string;
}
