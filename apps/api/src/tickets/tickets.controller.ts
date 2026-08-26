import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { SetTicketStatusDto } from './dto/set-ticket-status.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { PaginatedTicketsDto, TicketResponseDto } from './dto/ticket-response.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({
    summary: 'List tickets',
    description: 'Paginated, searchable across subject/description, filterable.',
  })
  @ApiOkResponse({ type: PaginatedTicketsDto })
  list(
    @Query() query: ListTicketsQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PaginatedTicketsDto> {
    return this.ticketsService.list(query, caller);
  }

  @Get(':id')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Get one ticket' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TicketResponseDto> {
    return this.ticketsService.findOne(id);
  }

  @Post()
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Create a ticket' })
  @ApiCreatedResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, or an unknown/inactive customerId/assignedAgentId.',
  })
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Update a ticket' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, or an unknown/inactive assignedAgentId.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.update(id, dto, caller);
  }

  @Patch(':id/status')
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Move a ticket through its status lifecycle' })
  @ApiOkResponse({ type: TicketResponseDto })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTicketStatusDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.setStatus(id, dto.status, caller);
  }

  @Patch(':id/assignment')
  @RequirePermissions('tickets:write')
  @ApiOperation({
    summary: 'Assign or release a ticket',
    description:
      'Without tickets:assign the caller may only claim the ticket for themselves, ' +
      'or release one already assigned to them.',
  })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiForbiddenResponse({ description: 'The caller may not assign to that user.' })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  @ApiBadRequestResponse({ description: 'Unknown or inactive assignedAgentId.' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.assign(id, dto.assignedAgentId ?? null, caller);
  }
}
