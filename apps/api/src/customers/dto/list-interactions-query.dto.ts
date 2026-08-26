import { ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionChannel, InteractionDirection } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

/**
 * Not paginated — matching the existing timeline, which returns the whole
 * history for one customer (Story 11's decision). Recorded here so it reads
 * as a deliberate choice rather than an oversight.
 */
export class ListInteractionsQueryDto {
  @ApiPropertyOptional({ enum: InteractionChannel })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({ enum: InteractionDirection })
  @IsOptional()
  @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only interactions attributed to this ticket.',
  })
  @IsOptional()
  @IsUUID()
  ticketId?: string;
}
