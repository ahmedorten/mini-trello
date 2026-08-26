import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateAgentTaskDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional({ enum: AgentTaskStatus })
  @IsOptional()
  @IsEnum(AgentTaskStatus)
  status?: AgentTaskStatus;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'May be in the past or the future. No validation either way — back-dating a missed reminder is legitimate.',
  })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  remindAt?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Defaults to the caller. Assigning to someone else requires tasks:manage.',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Derived from ticketId when omitted and ticketId is given. A mismatch with ticketId’s customer is a 400.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
