import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AgentDashboardQueryDto } from './dto/agent-dashboard-query.dto';
import { AgentDashboardDto } from './dto/agent-dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('agent')
  @RequirePermissions('dashboard:read')
  @ApiOperation({
    summary: 'Everything the agent dashboard renders, in one call',
    description:
      'Counts, breakdowns, and three capped ticket lists. tasksDueSoon is empty ' +
      'unless the caller also holds tasks:read.',
  })
  @ApiOkResponse({ type: AgentDashboardDto })
  agent(
    @Query() query: AgentDashboardQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AgentDashboardDto> {
    return this.dashboardService.agentDashboard(query, caller);
  }
}
