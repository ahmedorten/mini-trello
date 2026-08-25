import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Digits, spaces, and the punctuation a human types. Deliberately NOT E.164:
 *  parsing that needs a country context this application does not have. */
export const PHONE_PATTERN = /^[+0-9][0-9 ()-]{5,31}$/;
export const PHONE_MESSAGE = 'phone must be 6–32 characters of digits, spaces, +, -, ( and )';

export class CreateCustomerDto {
  @ApiPropertyOptional({ enum: CustomerType, default: CustomerType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiProperty({ example: 'Orten Trading', minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiPropertyOptional({ maxLength: 254 })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '+20 100 000 0000' })
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  alternatePhone?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine1?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine2?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.PROSPECT })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;
}
