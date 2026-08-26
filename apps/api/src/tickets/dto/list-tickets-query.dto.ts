import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Which assignment slice of the ticket table to return. A FILTER, not a
 *  security boundary — see Story 18 Product rule 4. */
export enum TicketScope {
  Mine = 'mine',
  Unassigned = 'unassigned',
  Workable = 'workable',
  All = 'all',
}

export class ListTicketsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on subject or description.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    enum: TicketScope,
    default: TicketScope.All,
    description:
      'mine = assigned to the caller; unassigned = no agent; workable = either; all = no filter.',
  })
  @IsOptional()
  @IsEnum(TicketScope)
  scope: TicketScope = TicketScope.All;
}
