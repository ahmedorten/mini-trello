import { ApiProperty } from '@nestjs/swagger';
import { UserRefDto } from '../../customers/dto/customer-response.dto';

export class TicketHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({ example: 'status' })
  field!: string;

  @ApiProperty({ required: false, nullable: true })
  oldValue!: string | null;

  @ApiProperty({ required: false, nullable: true })
  newValue!: string | null;

  @ApiProperty({ type: () => UserRefDto })
  changedBy!: UserRefDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
