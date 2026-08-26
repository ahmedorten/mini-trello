import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateInteractionDto, InteractionResponseDto } from './dto/interaction.dto';
import { ListInteractionsQueryDto } from './dto/list-interactions-query.dto';
import { InteractionsService } from './interactions.service';

@ApiTags('customer-interactions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('customers/:customerId/interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: 'List a customer’s interaction timeline, newest-occurred first' })
  @ApiOkResponse({ type: [InteractionResponseDto] })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  list(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: ListInteractionsQueryDto,
  ): Promise<InteractionResponseDto[]> {
    return this.interactionsService.list(customerId, query);
  }

  @Post()
  @RequirePermissions('interactions:write')
  @ApiOperation({
    summary: 'Log an interaction',
    description: 'occurredAt may be back-dated freely but must not be more than 5 minutes ahead.',
  })
  @ApiCreatedResponse({ type: InteractionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or occurredAt is in the future.' })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateInteractionDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    return this.interactionsService.create(customerId, dto, caller);
  }

  @Delete(':id')
  @RequirePermissions('interactions:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a logged interaction',
    description: 'The author, or a caller holding customers:archive. There is no edit route.',
  })
  @ApiNoContentResponse({ description: 'Interaction deleted.' })
  @ApiNotFoundResponse({
    description: 'No such customer, or no such interaction on that customer.',
  })
  remove(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.interactionsService.remove(customerId, id, caller);
  }
}
