import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'support-agent' })
  key!: string;

  @ApiProperty({ example: 'Support Agent' })
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [String], example: ['departments:read', 'branches:read'] })
  permissions!: string[];

  @ApiProperty({ example: 3, description: 'Active users currently holding this role.' })
  userCount!: number;
}
