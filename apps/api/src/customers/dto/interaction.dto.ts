import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionChannel, InteractionDirection } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRefDto } from './customer-response.dto';

export class CreateInteractionDto {
  @ApiProperty({ enum: InteractionChannel })
  @IsEnum(InteractionChannel)
  channel!: InteractionChannel;

  @ApiProperty({ enum: InteractionDirection })
  @IsEnum(InteractionDirection)
  direction!: InteractionDirection;

  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string;

  @ApiPropertyOptional({ maxLength: 8000 })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When it happened. Not more than 5 minutes in the future.',
  })
  @IsDateString()
  occurredAt!: string;
}

export class InteractionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ enum: InteractionChannel })
  channel!: InteractionChannel;

  @ApiProperty({ enum: InteractionDirection })
  direction!: InteractionDirection;

  @ApiProperty()
  subject!: string;

  @ApiProperty({ required: false, nullable: true })
  body!: string | null;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ type: () => UserRefDto })
  createdBy!: UserRefDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
