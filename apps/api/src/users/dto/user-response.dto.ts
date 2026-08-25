import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class OrgUnitRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'customer-support' })
  key!: string;

  @ApiProperty({ example: 'Customer Support' })
  name!: string;
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'agent@crm.local' })
  email!: string;

  @ApiProperty({ example: 'Nour Hassan' })
  fullName!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiPropertyOptional({ type: () => OrgUnitRefDto, nullable: true })
  department!: OrgUnitRefDto | null;

  @ApiPropertyOptional({ type: () => OrgUnitRefDto, nullable: true })
  branch!: OrgUnitRefDto | null;

  @ApiProperty({ type: [String], example: ['support-agent'] })
  roles!: string[];

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  lastLoginAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
