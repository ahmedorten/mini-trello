import { ApiProperty } from '@nestjs/swagger';
import { AgentTaskStatus } from '@prisma/client';
import { InteractionTicketRefDto } from '../../customers/dto/interaction.dto';
import { UserRefDto } from '../../customers/dto/customer-response.dto';
import { CustomerRefDto } from '../../tickets/dto/ticket-response.dto';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class AgentTaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Call back re: refund status' })
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: AgentTaskStatus, example: AgentTaskStatus.OPEN })
  status!: AgentTaskStatus;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  dueAt!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  remindAt!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty({ type: () => UserRefDto })
  assignee!: UserRefDto;

  @ApiProperty({ type: () => UserRefDto })
  createdBy!: UserRefDto;

  @ApiProperty({ type: () => InteractionTicketRefDto, nullable: true })
  ticket!: InteractionTicketRefDto | null;

  @ApiProperty({ type: () => CustomerRefDto, nullable: true })
  customer!: CustomerRefDto | null;

  @ApiProperty({
    description: 'dueAt is in the past and status is neither DONE nor CANCELLED.',
  })
  isOverdue!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedAgentTasksDto {
  @ApiProperty({ type: [AgentTaskResponseDto] })
  items!: AgentTaskResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
