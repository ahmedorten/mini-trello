import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Every field optional. `assignedAgentId: null` CLEARS the assignment —
 * distinguished from "absent" with `dto.assignedAgentId !== undefined`, so a
 * PATCH that omits the key leaves the current assignment alone. (Not a
 * `'assignedAgentId' in dto` check: under this project's TS target, a class
 * field declared without an initializer is still defined as an own property
 * at construction, so `in` is always true regardless of what the client
 * sent — `!== undefined` is what actually tracks presence here.)
 * `customerId` is deliberately absent: a ticket's customer link is immutable
 * after creation. `status` is NOT here — it moves through
 * PATCH /api/tickets/:id/status.
 */
export class UpdateTicketDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 8000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string | null;
}
