import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { InteractionResponseDto } from '../customers/dto/interaction.dto';
import { InteractionsService } from '../customers/interactions.service';
import {
  CreateTicketInteractionDto,
  ListTicketInteractionsQueryDto,
} from './dto/ticket-interaction.dto';
import { TicketsService } from './tickets.service';

@Injectable()
export class TicketInteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  async list(
    ticketId: string,
    query: ListTicketInteractionsQueryDto,
  ): Promise<InteractionResponseDto[]> {
    const { customerId } = await this.resolve(ticketId);

    // includeCustomerHistory drops the ticketId filter, so the workspace can
    // show "everything we have ever said to this customer" with the entries for
    // THIS ticket identifiable by their non-null `ticket` ref.
    return this.interactionsService.list(customerId, {
      channel: query.channel,
      direction: query.direction,
      ticketId: query.includeCustomerHistory ? undefined : ticketId,
    });
  }

  async create(
    ticketId: string,
    dto: CreateTicketInteractionDto,
    caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    const { customerId } = await this.resolve(ticketId);

    return this.interactionsService.create(customerId, { ...dto, ticketId }, caller);
  }

  /** 404s on an unknown ticket before any child work, same contract as
   *  TicketCommentsService.list()'s assertExists call. */
  private async resolve(ticketId: string): Promise<{ id: string; customerId: string }> {
    await this.ticketsService.assertExists(ticketId);

    return this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { id: true, customerId: true },
    });
  }
}
