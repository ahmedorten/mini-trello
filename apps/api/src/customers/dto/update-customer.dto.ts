import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';
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
import { PHONE_MESSAGE, PHONE_PATTERN } from './create-customer.dto';

/**
 * Every field optional. `null` on a nullable field CLEARS it — distinguished
 * from "absent" in the service with `'field' in dto`, so a PATCH that omits a
 * key leaves it alone. Status is NOT here: it moves through
 * PATCH /api/customers/:id/status, which carries the archive rule.
 */
export class UpdateCustomerDto {
  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ minLength: 2, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string | null;

  @ApiPropertyOptional({ maxLength: 254, nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+20 100 000 0000' })
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  alternatePhone?: string | null;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine1?: string | null;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine2?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string | null;
}
