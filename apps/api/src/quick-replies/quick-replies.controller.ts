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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  CreateQuickReplyDto,
  ListQuickRepliesQueryDto,
  QuickReplyResponseDto,
  UpdateQuickReplyDto,
} from './dto/quick-reply.dto';
import { QuickRepliesService } from './quick-replies.service';

@ApiTags('quick-replies')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('quick-replies')
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) {}

  @Get()
  @RequirePermissions('quick-replies:read')
  @ApiOperation({
    summary: 'List quick replies',
    description:
      'Filtered to isActive rows unless the caller holds quick-replies:write ' +
      'and passes includeInactive=true.',
  })
  @ApiOkResponse({ type: [QuickReplyResponseDto] })
  list(
    @Query() query: ListQuickRepliesQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<QuickReplyResponseDto[]> {
    return this.quickRepliesService.list(query, caller);
  }

  @Get(':id')
  @RequirePermissions('quick-replies:read')
  @ApiOperation({ summary: 'Get one quick reply' })
  @ApiOkResponse({ type: QuickReplyResponseDto })
  @ApiNotFoundResponse({ description: 'No such quick reply.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<QuickReplyResponseDto> {
    return this.quickRepliesService.findOne(id);
  }

  @Post()
  @RequirePermissions('quick-replies:write')
  @ApiOperation({ summary: 'Create a quick reply' })
  @ApiCreatedResponse({ type: QuickReplyResponseDto })
  @ApiConflictResponse({
    description: 'A quick reply with that key already exists for that locale.',
  })
  create(
    @Body() dto: CreateQuickReplyDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<QuickReplyResponseDto> {
    return this.quickRepliesService.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('quick-replies:write')
  @ApiOperation({ summary: 'Update a quick reply', description: 'key and locale are immutable.' })
  @ApiOkResponse({ type: QuickReplyResponseDto })
  @ApiNotFoundResponse({ description: 'No such quick reply.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuickReplyDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<QuickReplyResponseDto> {
    return this.quickRepliesService.update(id, dto, caller);
  }

  @Delete(':id')
  @RequirePermissions('quick-replies:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a quick reply',
    description: 'Hard delete. A seeded row deleted this way reappears on the next seed run.',
  })
  @ApiNoContentResponse({ description: 'Quick reply deleted.' })
  @ApiNotFoundResponse({ description: 'No such quick reply.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.quickRepliesService.remove(id, caller);
  }
}
