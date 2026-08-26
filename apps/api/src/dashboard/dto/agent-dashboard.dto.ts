import { ApiProperty } from '@nestjs/swagger';
import { TicketResponseDto } from '../../tickets/dto/ticket-response.dto';

/** One bucket of a breakdown. A flat array, not a keyed object: the frontend
 *  renders it in a fixed display order it owns, and a zero-count bucket is
 *  still present so a chart does not gain and lose axes between refreshes. */
export class DashboardBucketDto {
  @ApiProperty({ example: 'OPEN' })
  key!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class AgentTicketCountsDto {
  @ApiProperty({ example: 17, description: 'Tickets assigned to the caller, any status.' })
  assigned!: number;

  @ApiProperty({ example: 9, description: 'Caller-assigned tickets with status OPEN.' })
  open!: number;

  @ApiProperty({ example: 3, description: 'Caller-assigned tickets with status ON_HOLD.' })
  pending!: number;

  @ApiProperty({
    example: 2,
    description: 'Caller-assigned active tickets past their priority threshold.',
  })
  overdue!: number;

  @ApiProperty({ example: 5, description: 'Tickets with no assigned agent — workable by anyone.' })
  unassigned!: number;

  @ApiProperty({
    example: 4,
    description: 'Caller-assigned tickets moved to RESOLVED or CLOSED in the last 7 days.',
  })
  resolvedLast7Days!: number;
}

export class AgentTaskSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Call back about the invoice' })
  title!: string;

  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'], example: 'OPEN' })
  status!: string;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  dueAt!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  remindAt!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  ticketId!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  customerId!: string | null;

  @ApiProperty({
    example: false,
    description: 'dueAt is in the past and status is neither DONE nor CANCELLED.',
  })
  isOverdue!: boolean;
}

export class AgentDashboardDto {
  @ApiProperty({ type: () => AgentTicketCountsDto })
  counts!: AgentTicketCountsDto;

  @ApiProperty({
    type: [DashboardBucketDto],
    description: 'One bucket per TicketStatus, zeroes included.',
  })
  byStatus!: DashboardBucketDto[];

  @ApiProperty({
    type: [DashboardBucketDto],
    description: 'One bucket per TicketPriority, zeroes included.',
  })
  byPriority!: DashboardBucketDto[];

  @ApiProperty({
    type: [DashboardBucketDto],
    description: 'One bucket per TicketCategory, zeroes included.',
  })
  byCategory!: DashboardBucketDto[];

  @ApiProperty({
    type: [TicketResponseDto],
    description: 'Up to 5 of the caller’s most pressing tickets.',
  })
  focusTickets!: TicketResponseDto[];

  @ApiProperty({
    type: [TicketResponseDto],
    description: 'Up to 5 overdue tickets in the requested scope.',
  })
  overdueTickets!: TicketResponseDto[];

  @ApiProperty({
    type: [TicketResponseDto],
    description: 'Up to 5 unassigned tickets the caller could pick up.',
  })
  unassignedTickets!: TicketResponseDto[];

  @ApiProperty({
    type: [AgentTaskSummaryDto],
    description:
      'Up to 5 of the caller’s open tasks, soonest due first. Empty if the caller lacks tasks:read.',
  })
  tasksDueSoon!: AgentTaskSummaryDto[];

  @ApiProperty({ example: 5, description: 'The cap applied to every embedded list above.' })
  listLimit!: number;

  @ApiProperty({
    format: 'date-time',
    description: 'Server clock at computation time. Every overdue flag is relative to this.',
  })
  generatedAt!: string;
}
