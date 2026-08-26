import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { InteractionChannel, InteractionDirection } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CreateInteractionDto } from '../../customers/dto/interaction.dto';

/**
 * The same four required fields as CreateInteractionDto, plus optional body,
 * but NO customerId and NO ticketId — both come from the route/ticket
 * (Product rule 5). Extending via OmitType keeps the validators in step with
 * CreateInteractionDto automatically.
 */
export class CreateTicketInteractionDto extends OmitType(CreateInteractionDto, [
  'ticketId',
] as const) {}

export class ListTicketInteractionsQueryDto {
  @ApiPropertyOptional({ enum: InteractionChannel })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({ enum: InteractionDirection })
  @IsOptional()
  @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @ApiPropertyOptional({
    description:
      'When true, return the customer’s whole interaction history instead of ' +
      'just this ticket’s. Entries for this ticket are still identifiable by a ' +
      'non-null ticket ref.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeCustomerHistory?: boolean;
}
