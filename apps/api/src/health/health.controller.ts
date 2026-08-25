import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Service health check',
    description: 'Reports process liveness and a PostgreSQL round-trip probe.',
  })
  @ApiOkResponse({ type: HealthResponseDto, description: 'All dependencies healthy.' })
  @ApiServiceUnavailableResponse({
    type: HealthResponseDto,
    description: 'The database probe failed.',
  })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const result = await this.healthService.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
