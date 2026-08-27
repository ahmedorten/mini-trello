import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto, SortOrder } from '../../common/dto/pagination.dto';

/** Columns the ticket list may be ordered by. A closed enum, not a string:
 *  Story 25 Product rule 2. Absent = the legacy createdAt-descending order. */
export enum TicketSortField {
  Subject = 'subject',
  Category = 'category',
  Priority = 'priority',
  Status = 'status',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

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

  @ApiPropertyOptional({
    enum: TicketSortField,
    description: 'Omit for the default createdAt-descending order.',
  })
  @IsOptional()
  @IsEnum(TicketSortField)
  sort?: TicketSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Desc })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
