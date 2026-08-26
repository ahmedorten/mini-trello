import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AgentTasksService } from './agent-tasks.service';
import { AgentTaskResponseDto, PaginatedAgentTasksDto } from './dto/agent-task.dto';
import { CreateAgentTaskDto } from './dto/create-agent-task.dto';
import { ListAgentTasksQueryDto } from './dto/list-agent-tasks-query.dto';
import { SetAgentTaskStatusDto } from './dto/set-agent-task-status.dto';
import { UpdateAgentTaskDto } from './dto/update-agent-task.dto';

@ApiTags('agent-tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tasks')
export class AgentTasksController {
  constructor(private readonly agentTasksService: AgentTasksService) {}

  @Get()
  @RequirePermissions('tasks:read')
  @ApiOperation({
    summary: 'List agent tasks',
    description:
      'Defaults to the caller’s own tasks (scope=mine). scope=all, or a ' +
      'cross-user assigneeId filter, requires tasks:manage.',
  })
  @ApiOkResponse({ type: PaginatedAgentTasksDto })
  list(
    @Query() query: ListAgentTasksQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PaginatedAgentTasksDto> {
    return this.agentTasksService.list(query, caller);
  }

  @Get(':id')
  @RequirePermissions('tasks:read')
  @ApiOperation({ summary: 'Get one task' })
  @ApiOkResponse({ type: AgentTaskResponseDto })
  @ApiNotFoundResponse({ description: 'No such task.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AgentTaskResponseDto> {
    return this.agentTasksService.findOne(id, caller);
  }

  @Post()
  @RequirePermissions('tasks:write')
  @ApiOperation({
    summary: 'Create a task',
    description: 'Defaults to assigning the caller. Assigning someone else requires tasks:manage.',
  })
  @ApiCreatedResponse({ type: AgentTaskResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or a ticketId/customerId mismatch.' })
  create(
    @Body() dto: CreateAgentTaskDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AgentTaskResponseDto> {
    return this.agentTasksService.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('tasks:write')
  @ApiOperation({
    summary: 'Update a task',
    description: 'The assignee, the creator, or a tasks:manage holder.',
  })
  @ApiOkResponse({ type: AgentTaskResponseDto })
  @ApiNotFoundResponse({ description: 'No such task.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentTaskDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AgentTaskResponseDto> {
    return this.agentTasksService.update(id, dto, caller);
  }

  @Patch(':id/status')
  @RequirePermissions('tasks:write')
  @ApiOperation({
    summary: 'Change a task’s status',
    description: 'Moving to DONE stamps completedAt; moving out of DONE clears it.',
  })
  @ApiOkResponse({ type: AgentTaskResponseDto })
  @ApiNotFoundResponse({ description: 'No such task.' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAgentTaskStatusDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AgentTaskResponseDto> {
    return this.agentTasksService.setStatus(id, dto.status, caller);
  }

  @Delete(':id')
  @RequirePermissions('tasks:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a task',
    description: 'The assignee, the creator, or a tasks:manage holder.',
  })
  @ApiNoContentResponse({ description: 'Task deleted.' })
  @ApiNotFoundResponse({ description: 'No such task.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.agentTasksService.remove(id, caller);
  }
}
