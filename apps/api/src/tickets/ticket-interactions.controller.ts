import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { InteractionResponseDto } from '../customers/dto/interaction.dto';
import {
  CreateTicketInteractionDto,
  ListTicketInteractionsQueryDto,
} from './dto/ticket-interaction.dto';
import { TicketInteractionsService } from './ticket-interactions.service';

@ApiTags('ticket-interactions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tickets/:ticketId/interactions')
export class TicketInteractionsController {
  constructor(private readonly ticketInteractionsService: TicketInteractionsService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({
    summary: 'The communication timeline for one ticket, newest-occurred first',
    description:
      'By default only interactions attributed to this ticket. Pass ' +
      'includeCustomerHistory=true for the customer’s whole timeline, which is ' +
      'what the workspace renders.',
  })
  @ApiOkResponse({ type: [InteractionResponseDto] })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  list(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query() query: ListTicketInteractionsQueryDto,
  ): Promise<InteractionResponseDto[]> {
    return this.ticketInteractionsService.list(ticketId, query);
  }

  @Post()
  @RequirePermissions('interactions:write')
  @ApiOperation({
    summary: 'Log an interaction against this ticket',
    description:
      'The customer is derived from the ticket; do not send customerId. This is ' +
      'how "responding through a channel" is recorded — no external message is sent.',
  })
  @ApiCreatedResponse({ type: InteractionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or occurredAt is in the future.' })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateTicketInteractionDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    return this.ticketInteractionsService.create(ticketId, dto, caller);
  }
}
