import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto, SortOrder } from '../../common/dto/pagination.dto';

/** Columns the customer list may be ordered by. A closed enum, not a string:
 *  Story 25 Product rule 2. Absent = the legacy [name asc, createdAt desc]. */
export enum CustomerSortField {
  Name = 'name',
  Type = 'type',
  Email = 'email',
  City = 'city',
  Status = 'status',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

export class ListCustomersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on name, company, email, or phone.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    enum: CustomerSortField,
    description: 'Omit for the default name-ascending order.',
  })
  @IsOptional()
  @IsEnum(CustomerSortField)
  sort?: CustomerSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Asc })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
