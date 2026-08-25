import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { TicketHistoryResponseDto } from './dto/ticket-history.dto';
import { TicketHistoryService } from './ticket-history.service';

@ApiTags('ticket-history')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tickets/:ticketId/history')
export class TicketHistoryController {
  constructor(private readonly ticketHistoryService: TicketHistoryService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: "A ticket's audit trail, newest change first" })
  @ApiOkResponse({ type: [TicketHistoryResponseDto] })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string): Promise<TicketHistoryResponseDto[]> {
    return this.ticketHistoryService.list(ticketId);
  }
}
