import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionChannel } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRefDto } from '../../customers/dto/customer-response.dto';

export class CreateQuickReplyDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 100,
    example: 'greeting.welcome',
    description: 'Stable identifier. Immutable after creation.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  key!: string;

  @ApiProperty({ example: 'en', description: 'Immutable after creation.' })
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  locale!: string;

  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 8000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional({
    enum: InteractionChannel,
    description:
      'Omit for a channel-agnostic reply, shown regardless of the picker’s channel filter.',
  })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * `key` and `locale` are deliberately absent — immutable after creation,
 * matching OrgService's "key is immutable" decision. Everything else is
 * optional; `channel` accepts an explicit `null` to make a reply
 * channel-agnostic again.
 */
export class UpdateQuickReplyDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 8000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body?: string;

  @ApiPropertyOptional({ enum: InteractionChannel, nullable: true })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListQuickRepliesQueryDto {
  @ApiPropertyOptional({ example: 'ar' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @ApiPropertyOptional({
    enum: InteractionChannel,
    description: 'Matches this channel OR a channel-agnostic reply (channel: null).',
  })
  @IsOptional()
  @IsEnum(InteractionChannel)
  channel?: InteractionChannel;

  @ApiPropertyOptional({
    default: false,
    description:
      'Include inactive rows. Honoured only for a quick-replies:write holder — ' +
      'silently ignored otherwise, not rejected.',
  })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}

export class QuickReplyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'greeting.welcome' })
  key!: string;

  @ApiProperty({ example: 'en' })
  locale!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ enum: InteractionChannel, required: false, nullable: true })
  channel!: InteractionChannel | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: () => UserRefDto, nullable: true })
  createdBy!: UserRefDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
