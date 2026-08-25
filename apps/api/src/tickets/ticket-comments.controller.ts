import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CommentResponseDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { TicketCommentsService } from './ticket-comments.service';

@ApiTags('ticket-comments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('tickets/:ticketId/comments')
export class TicketCommentsController {
  constructor(private readonly ticketCommentsService: TicketCommentsService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: "List a ticket's comments, newest first" })
  @ApiOkResponse({ type: [CommentResponseDto] })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string): Promise<CommentResponseDto[]> {
    return this.ticketCommentsService.list(ticketId);
  }

  @Post()
  @RequirePermissions('ticket-comments:write')
  @ApiOperation({ summary: 'Add a comment to a ticket' })
  @ApiCreatedResponse({ type: CommentResponseDto })
  @ApiNotFoundResponse({ description: 'No such ticket.' })
  create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CommentResponseDto> {
    return this.ticketCommentsService.create(ticketId, dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('ticket-comments:write')
  @ApiOperation({
    summary: 'Edit a comment',
    description: 'Only the author may edit their own comment.',
  })
  @ApiOkResponse({ type: CommentResponseDto })
  @ApiNotFoundResponse({ description: 'No such ticket, or no such comment on that ticket.' })
  update(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CommentResponseDto> {
    return this.ticketCommentsService.update(ticketId, id, dto, caller);
  }

  @Delete(':id')
  @RequirePermissions('ticket-comments:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a comment',
    description: 'The author, or a caller holding tickets:manage.',
  })
  @ApiNoContentResponse({ description: 'Comment deleted.' })
  @ApiNotFoundResponse({ description: 'No such ticket, or no such comment on that ticket.' })
  remove(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.ticketCommentsService.remove(ticketId, id, caller);
  }
}
