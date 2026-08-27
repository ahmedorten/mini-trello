import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  InteractionChannel,
  InteractionDeliveryStatus,
  InteractionDirection,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * Paginated, unlike ListInteractionsQueryDto — this feed spans every customer
 * and has no natural bound (Product rule 8).
 */
export class ListTimelineQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InteractionChannel })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({ enum: InteractionDirection })
  @IsOptional()
  @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @ApiPropertyOptional({ enum: InteractionDeliveryStatus })
  @IsOptional()
  @IsEnum(InteractionDeliveryStatus)
  deliveryStatus?: InteractionDeliveryStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only interactions whose customer is assigned to this agent.',
  })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({
    description:
      'Shorthand for assignedAgentId = the caller. NOT a security scope — it is ' +
      'a filter, exactly as TicketScope is. When both are present, ' +
      'assignedAgentId wins.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredTo?: string;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Case-insensitive substring of subject or body.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ description: 'Only interactions attributed to a ticket.' })
  @IsOptional()
  @IsBoolean()
  ticketLinkedOnly?: boolean;
}

/**
 * A strict subset of the timeline filters. A filter that can only match SOME
 * messages in a group — a text search, a direction — would produce a group
 * whose messageCount disagrees with its own contents, so those are deliberately
 * absent here.
 */
export class ListConversationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: InteractionChannel })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only conversations whose customer is assigned to this agent.',
  })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({
    description: 'Shorthand for assignedAgentId = the caller.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mine?: boolean;
}
