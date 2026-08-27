import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto, SortOrder } from '../../common/dto/pagination.dto';

/** Columns the user list may be ordered by. A closed enum, not a string:
 *  Story 25 Product rule 2. Absent = the legacy [fullName asc, email asc]. */
export enum UserSortField {
  FullName = 'fullName',
  Email = 'email',
  IsActive = 'isActive',
  LastLoginAt = 'lastLoginAt',
  CreatedAt = 'createdAt',
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on email or full name.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 'support-agent' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleKey?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Omit for both.' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiPropertyOptional({
    enum: UserSortField,
    description: 'Omit for the default fullName-ascending order.',
  })
  @IsOptional()
  @IsEnum(UserSortField)
  sort?: UserSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Asc })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
