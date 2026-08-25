import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USER_REF_SELECT } from '../customers/customers.service';
import { TicketsService } from './tickets.service';
import { TicketHistoryResponseDto } from './dto/ticket-history.dto';

const HISTORY_SELECT = {
  id: true,
  ticketId: true,
  field: true,
  oldValue: true,
  newValue: true,
  createdAt: true,
  changedBy: { select: USER_REF_SELECT },
} satisfies Prisma.TicketHistorySelect;

type SelectedHistory = Prisma.TicketHistoryGetPayload<{ select: typeof HISTORY_SELECT }>;

@Injectable()
export class TicketHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  async list(ticketId: string): Promise<TicketHistoryResponseDto[]> {
    await this.ticketsService.assertExists(ticketId);

    const rows = await this.prisma.ticketHistory.findMany({
      where: { ticketId },
      select: HISTORY_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => TicketHistoryService.toResponse(row));
  }

  private static toResponse(row: SelectedHistory): TicketHistoryResponseDto {
    return {
      id: row.id,
      ticketId: row.ticketId,
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      changedBy: row.changedBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
