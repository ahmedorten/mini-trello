import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * There is deliberately NO `direction` field: the route always writes INBOUND
 * (Product rule 3).
 *
 * `metadata` is the one place forbidNonWhitelisted (main.ts) needs care: a
 * nested object passes because @IsObject() accepts it wholesale and no nested
 * DTO is declared. The global pipe still rejects unknown TOP-LEVEL keys, which
 * is the intended behaviour for a documented webhook contract — a sender with
 * extra data puts it in `metadata`.
 */
export class InboundMessageDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'When known, the customer this message belongs to. Otherwise the address ' +
      'is matched against Customer.email and Customer.phone.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({ maxLength: 320 })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  address?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @ApiProperty({ minLength: 1, maxLength: 8000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'The sender’s own message id. Supplying it makes the delivery idempotent ' +
      '(a repeat returns 200 with the stored row); omitting it does not.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Raw provider payload, stored for diagnosis and never returned.',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
