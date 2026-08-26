import { ApiProperty } from '@nestjs/swagger';
import { AgentTaskStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetAgentTaskStatusDto {
  @ApiProperty({ enum: AgentTaskStatus, example: AgentTaskStatus.DONE })
  @IsEnum(AgentTaskStatus)
  status!: AgentTaskStatus;
}
