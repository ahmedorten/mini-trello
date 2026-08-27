import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
  COMMUNICATION_SEND_PERMISSION,
  CommunicationService,
} from './communication.service';
import {
  ListConversationsQueryDto,
  ListTimelineQueryDto,
} from './dto/list-timeline-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationListDto, PaginatedTimelineDto } from './dto/timeline.dto';
import { TimelineService } from './timeline.service';

@ApiTags('communication')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('communication')
export class CommunicationController {
  constructor(
    private readonly communication: CommunicationService,
    private readonly timeline: TimelineService,
  ) {}

  @Post('messages')
  @RequirePermissions(COMMUNICATION_SEND_PERMISSION)
  @ApiOperation({
    summary: 'Send a message through a communication channel',
    description:
      'Resolves the channel’s adapter, validates and addresses the message ' +
      'through it, then records the result as an OUTBOUND interaction. NO ' +
      'external message is sent: every channel reports providerConfigured ' +
      'false, so the response carries deliveryStatus LOGGED.',
  })
  @ApiCreatedResponse({ type: InteractionResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, the channel cannot send, no address could be ' +
      'resolved, the customer is archived, or the ticket belongs to a ' +
      'different customer.',
  })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  send(
    @Body() dto: SendMessageDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    return this.communication.send(dto, caller);
  }

  @Get('timeline')
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'The unified interaction timeline across every customer, newest-occurred first',
    description:
      'Paginated, unlike the per-customer and per-ticket timelines — this feed ' +
      'has no natural bound.',
  })
  @ApiOkResponse({ type: PaginatedTimelineDto })
  list(
    @Query() query: ListTimelineQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PaginatedTimelineDto> {
    return this.timeline.list(query, caller);
  }

  @Get('conversations')
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'The timeline grouped into conversations by customer, channel, and thread',
    description:
      'Interactions logged before the delivery columns existed have a null ' +
      'threadKey and group into one "earlier history" conversation per channel.',
  })
  @ApiOkResponse({ type: ConversationListDto })
  conversations(
    @Query() query: ListConversationsQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<ConversationListDto> {
    return this.timeline.conversations(query, caller);
  }
}
