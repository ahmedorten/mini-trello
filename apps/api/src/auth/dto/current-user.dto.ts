import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@crm.local' })
  email!: string;

  @ApiProperty({ example: 'System Administrator' })
  fullName!: string;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  departmentId!: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  branchId!: string | null;

  @ApiProperty({ type: [String], example: ['system-administrator'] })
  roles!: string[];

  @ApiProperty({ type: [String], example: ['users:read', 'users:write'] })
  permissions!: string[];
}
