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
import { CreateNoteDto, NoteResponseDto, UpdateNoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';

@ApiTags('customer-notes')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('customers/:customerId/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: 'List a customer’s notes, newest first' })
  @ApiOkResponse({ type: [NoteResponseDto] })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  list(@Param('customerId', ParseUUIDPipe) customerId: string): Promise<NoteResponseDto[]> {
    return this.notesService.list(customerId);
  }

  @Post()
  @RequirePermissions('notes:write')
  @ApiOperation({ summary: 'Add a note to a customer' })
  @ApiCreatedResponse({ type: NoteResponseDto })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<NoteResponseDto> {
    return this.notesService.create(customerId, dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('notes:write')
  @ApiOperation({ summary: 'Edit a note', description: 'Only the author may edit their own note.' })
  @ApiOkResponse({ type: NoteResponseDto })
  @ApiNotFoundResponse({ description: 'No such customer, or no such note on that customer.' })
  update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<NoteResponseDto> {
    return this.notesService.update(customerId, id, dto, caller);
  }

  @Delete(':id')
  @RequirePermissions('notes:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a note',
    description: 'The author, or a caller holding customers:archive.',
  })
  @ApiNoContentResponse({ description: 'Note deleted.' })
  @ApiNotFoundResponse({ description: 'No such customer, or no such note on that customer.' })
  remove(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.notesService.remove(customerId, id, caller);
  }
}
