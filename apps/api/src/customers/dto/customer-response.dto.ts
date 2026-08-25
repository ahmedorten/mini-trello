import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

/** A user referenced from a customer. Deliberately three fields: enough to
 *  render "assigned to Nour Hassan", nothing that leaks account state. */
export class UserRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Nour Hassan' })
  fullName!: string;

  @ApiProperty({ example: 'nour@crm.local' })
  email!: string;
}

export class CustomerCountsDto {
  @ApiProperty({ example: 3 })
  notes!: number;

  @ApiProperty({ example: 1 })
  attachments!: number;

  @ApiProperty({ example: 7 })
  interactions!: number;
}

export class CustomerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CustomerType, example: CustomerType.COMPANY })
  type!: CustomerType;

  @ApiProperty({ example: 'Orten Trading' })
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  companyName!: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'contact@orten.example' })
  email!: string | null;

  @ApiProperty({ required: false, nullable: true, example: '+20 100 000 0000' })
  phone!: string | null;

  @ApiProperty({ required: false, nullable: true })
  alternatePhone!: string | null;

  @ApiProperty({ required: false, nullable: true })
  addressLine1!: string | null;

  @ApiProperty({ required: false, nullable: true })
  addressLine2!: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Cairo' })
  city!: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Egypt' })
  country!: string | null;

  @ApiProperty({ required: false, nullable: true })
  postalCode!: string | null;

  @ApiProperty({ enum: CustomerStatus, example: CustomerStatus.ACTIVE })
  status!: CustomerStatus;

  @ApiPropertyOptional({ type: () => UserRefDto, nullable: true })
  assignedAgent!: UserRefDto | null;

  @ApiPropertyOptional({ type: () => UserRefDto, nullable: true })
  createdBy!: UserRefDto | null;

  @ApiProperty({ type: () => CustomerCountsDto })
  counts!: CustomerCountsDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedCustomersDto {
  @ApiProperty({ type: [CustomerResponseDto] })
  items!: CustomerResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
