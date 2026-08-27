import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgentTaskStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto, SortOrder } from '../../common/dto/pagination.dto';

/** Which assignment slice of the task table to return. Unlike
 *  TicketScope.All, `AgentTaskScope.All` is gated on `tasks:manage`
 *  (Product rule 9) — a personal to-do list is not shared data by default. */
export enum AgentTaskScope {
  Mine = 'mine',
  All = 'all',
}

/** Columns the agent task list may be ordered by. A closed enum, not a
 *  string: Story 25 Product rule 2. Absent = the legacy [dueAt asc,
 *  createdAt desc]. */
export enum AgentTaskSortField {
  Title = 'title',
  Status = 'status',
  DueAt = 'dueAt',
  CreatedAt = 'createdAt',
}

export class ListAgentTasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: AgentTaskScope,
    default: AgentTaskScope.Mine,
    description:
      'mine = assigned to the caller (default); all = every task, requires tasks:manage.',
  })
  @IsOptional()
  @IsEnum(AgentTaskScope)
  scope: AgentTaskScope = AgentTaskScope.Mine;

  @ApiPropertyOptional({ enum: AgentTaskStatus })
  @IsOptional()
  @IsEnum(AgentTaskStatus)
  status?: AgentTaskStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'A specific assignee. Requires tasks:manage unless it equals the caller.',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Tasks due before this timestamp.' })
  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @ApiPropertyOptional({
    description: 'Only OPEN/IN_PROGRESS tasks whose dueAt has passed.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional({
    enum: AgentTaskSortField,
    description: 'Omit for the default dueAt-ascending order.',
  })
  @IsOptional()
  @IsEnum(AgentTaskSortField)
  sort?: AgentTaskSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Asc })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
