import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionChannel } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * There is deliberately NO `direction` field: the route always writes OUTBOUND
 * (Product rule 3). Accepting it would allow POST /messages with
 * direction: INBOUND, claiming the customer sent something the agent typed.
 */
export class SendMessageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Ticket to attribute the message to. MUST belong to the same customer — ' +
      'a mismatch is a 400, enforced by InteractionsService.',
  })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiProperty({ enum: InteractionChannel })
  @IsEnum(InteractionChannel)
  channel!: InteractionChannel;

  @ApiPropertyOptional({
    maxLength: 160,
    description:
      'Ignored by channels whose capabilities report supportsSubject: false — ' +
      'those synthesise a subject from the body.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 8000,
    description:
      'Required, unlike CreateInteractionDto.body: you can log a call with no ' +
      'body, but you cannot send an empty message. Per-channel limits are ' +
      'tighter — see maxBodyLength on GET /api/communication/channels.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional({
    description:
      'Counterparty address. Defaults to the customer’s email or phone ' +
      'depending on the channel’s addressKind. 320 is the RFC-5321 maximum ' +
      'length of an email address, and comfortably covers a phone number or a ' +
      'session id.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  address?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Defaults to now. Not more than 5 minutes in the future.',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
