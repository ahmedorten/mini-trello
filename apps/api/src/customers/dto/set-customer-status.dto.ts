import { ApiProperty } from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetCustomerStatusDto {
  @ApiProperty({ enum: CustomerStatus, example: CustomerStatus.ACTIVE })
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;
}
