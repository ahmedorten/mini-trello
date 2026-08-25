import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const KEY_PATTERN = /^[a-z0-9-]+$/;
const KEY_MESSAGE = 'key must be lower-case letters, digits, and hyphens';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'customer-support', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  @Matches(KEY_PATTERN, { message: KEY_MESSAGE })
  key!: string;

  @ApiProperty({ example: 'Customer Support', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'Customer Support', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'customer-support' })
  key!: string;

  @ApiProperty({ example: 'Customer Support' })
  name!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CreateBranchDto {
  @ApiProperty({ example: 'head-office', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  @Matches(KEY_PATTERN, { message: KEY_MESSAGE })
  key!: string;

  @ApiProperty({ example: 'Head Office', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Cairo', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Head Office', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Cairo', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BranchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'head-office' })
  key!: string;

  @ApiProperty({ example: 'Head Office' })
  name!: string;

  @ApiProperty({ required: false, nullable: true, example: 'Cairo' })
  city!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
