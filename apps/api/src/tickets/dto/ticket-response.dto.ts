import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { UserRefDto } from '../../customers/dto/customer-response.dto';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

/** A customer referenced from a ticket. Three fields: enough to render
 *  "Orten Trading" as a link, nothing that duplicates CustomerResponseDto. */
export class CustomerRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Orten Trading' })
  name!: string;

  @ApiProperty({ required: false, nullable: true, example: 'contact@orten.example' })
  email!: string | null;
}

export class TicketCountsDto {
  @ApiProperty({ example: 4 })
  comments!: number;

  @ApiProperty({ example: 2 })
  attachments!: number;

  @ApiProperty({ example: 3 })
  history!: number;
}

export class TicketResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: () => CustomerRefDto })
  customer!: CustomerRefDto;

  @ApiProperty({ example: 'Cannot log in after password reset' })
  subject!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.TECHNICAL })
  category!: TicketCategory;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.HIGH })
  priority!: TicketPriority;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.OPEN })
  status!: TicketStatus;

  @ApiProperty({ type: () => UserRefDto, nullable: true })
  assignedAgent!: UserRefDto | null;

  @ApiProperty({ type: () => UserRefDto, nullable: true })
  createdBy!: UserRefDto | null;

  @ApiProperty({ type: () => TicketCountsDto })
  counts!: TicketCountsDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedTicketsDto {
  @ApiProperty({ type: [TicketResponseDto] })
  items!: TicketResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
