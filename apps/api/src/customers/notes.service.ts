import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ARCHIVE_PERMISSION, CustomersService, USER_REF_SELECT } from './customers.service';
import { CreateNoteDto, NoteResponseDto, UpdateNoteDto } from './dto/note.dto';

const NOTE_SELECT = {
  id: true,
  customerId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: USER_REF_SELECT },
} satisfies Prisma.CustomerNoteSelect;

type SelectedNote = Prisma.CustomerNoteGetPayload<{ select: typeof NOTE_SELECT }>;

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async list(customerId: string): Promise<NoteResponseDto[]> {
    await this.customersService.assertExists(customerId);

    const notes = await this.prisma.customerNote.findMany({
      where: { customerId },
      select: NOTE_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note) => NotesService.toResponse(note));
  }

  async create(
    customerId: string,
    dto: CreateNoteDto,
    caller: AuthenticatedUser,
  ): Promise<NoteResponseDto> {
    await this.customersService.assertExists(customerId);

    const created = await this.prisma.customerNote.create({
      data: { customerId, authorId: caller.id, body: dto.body.trim() },
      select: NOTE_SELECT,
    });

    this.logger.log({ actorId: caller.id, customerId, noteId: created.id }, 'Note created');

    return NotesService.toResponse(created);
  }

  async update(
    customerId: string,
    id: string,
    dto: UpdateNoteDto,
    caller: AuthenticatedUser,
  ): Promise<NoteResponseDto> {
    const note = await this.assertScoped(customerId, id);

    if (note.authorId !== caller.id) {
      throw new ForbiddenException('Only the author can edit a note.');
    }

    const updated = await this.prisma.customerNote.update({
      where: { id },
      data: { body: dto.body.trim() },
      select: NOTE_SELECT,
    });

    this.logger.log({ actorId: caller.id, customerId, noteId: id }, 'Note updated');

    return NotesService.toResponse(updated);
  }

  async remove(customerId: string, id: string, caller: AuthenticatedUser): Promise<void> {
    const note = await this.assertScoped(customerId, id);

    if (note.authorId !== caller.id && !caller.permissions.includes(ARCHIVE_PERMISSION)) {
      throw new ForbiddenException(
        'Only the author or a customer administrator can delete a note.',
      );
    }

    await this.prisma.customerNote.delete({ where: { id } });

    this.logger.log({ actorId: caller.id, customerId, noteId: id }, 'Note deleted');
  }

  private async assertScoped(customerId: string, id: string): Promise<SelectedNote> {
    const note = await this.prisma.customerNote.findFirst({
      where: { id, customerId },
      select: NOTE_SELECT,
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    return note;
  }

  private static toResponse(note: SelectedNote): NoteResponseDto {
    return {
      id: note.id,
      customerId: note.customerId,
      author: note.author,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }
}
