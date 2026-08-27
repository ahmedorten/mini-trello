import { ApiProperty } from '@nestjs/swagger';
import { InteractionChannel } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';
import {
  InteractionCustomerRefDto,
  InteractionResponseDto,
} from '../../customers/dto/interaction.dto';

export class PaginatedTimelineDto {
  @ApiProperty({ type: () => [InteractionResponseDto] })
  items!: InteractionResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

/** One conversation: a customer, a channel, and a thread. */
export class ConversationDto {
  @ApiProperty({ type: () => InteractionCustomerRefDto })
  customer!: InteractionCustomerRefDto;

  @ApiProperty({ enum: InteractionChannel })
  channel!: InteractionChannel;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Null for interactions logged before Story 22, which never recorded an ' +
      'address to derive a key from (Product rule 11).',
  })
  threadKey!: string | null;

  @ApiProperty({ example: 12 })
  messageCount!: number;

  @ApiProperty({ format: 'date-time' })
  lastOccurredAt!: string;

  @ApiProperty({ type: () => InteractionResponseDto })
  lastMessage!: InteractionResponseDto;
}

export class ConversationListDto {
  @ApiProperty({ type: () => [ConversationDto] })
  items!: ConversationDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
