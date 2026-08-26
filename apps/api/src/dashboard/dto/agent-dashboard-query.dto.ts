import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TicketScope } from '../../tickets/dto/list-tickets-query.dto';

export class AgentDashboardQueryDto {
  @ApiPropertyOptional({
    enum: TicketScope,
    default: TicketScope.Mine,
    description:
      'Which slice the breakdowns and lists cover. Defaults to the caller’s own tickets.',
  })
  @IsOptional()
  @IsEnum(TicketScope)
  scope: TicketScope = TicketScope.Mine;
}
