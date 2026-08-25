import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SetUserRolesDto {
  @ApiProperty({ type: [String], example: ['support-agent', 'reporting-user'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  roleKeys!: string[];
}
