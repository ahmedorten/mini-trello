import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgentTaskStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Every field optional. `notes`, `dueAt`, `remindAt`, `ticketId`, and
 * `customerId` accept an explicit `null` to clear them — distinguished from
 * "absent" in the service with `dto.field !== undefined`, NOT a
 * `'field' in dto` check: under this project's TS target, a class field
 * declared without an initializer is still defined as an own property at
 * construction, so `in` is always true regardless of what the client sent.
 * `!== undefined` is what actually tracks presence here (see
 * update-ticket.dto.ts for the original note — this DTO has five nullable
 * fields instead of one). `status` moves through both this route and the
 * dedicated PATCH /:id/status route; `assigneeId` reassignment to someone
 * else requires `tasks:manage`.
 */
export class UpdateAgentTaskDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: AgentTaskStatus })
  @IsOptional()
  @IsEnum(AgentTaskStatus)
  status?: AgentTaskStatus;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  remindAt?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Reassigning to someone else requires tasks:manage.',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  ticketId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string | null;
}
