import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ARCHIVE_PERMISSION, CustomersService, USER_REF_SELECT } from './customers.service';
import { CreateInteractionDto, InteractionResponseDto } from './dto/interaction.dto';
import { ListInteractionsQueryDto } from './dto/list-interactions-query.dto';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const INTERACTION_SELECT = {
  id: true,
  customerId: true,
  channel: true,
  direction: true,
  subject: true,
  body: true,
  occurredAt: true,
  createdAt: true,
  createdById: true,
  createdBy: { select: USER_REF_SELECT },
  ticketId: true,
  ticket: { select: { id: true, subject: true } },
} satisfies Prisma.CustomerInteractionSelect;

type SelectedInteraction = Prisma.CustomerInteractionGetPayload<{
  select: typeof INTERACTION_SELECT;
}>;

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async list(
    customerId: string,
    query: ListInteractionsQueryDto = {},
  ): Promise<InteractionResponseDto[]> {
    await this.customersService.assertExists(customerId);

    const where: Prisma.CustomerInteractionWhereInput = { customerId };

    if (query.channel) where.channel = query.channel;
    if (query.direction) where.direction = query.direction;
    if (query.ticketId) where.ticketId = query.ticketId;

    const interactions = await this.prisma.customerInteraction.findMany({
      where,
      select: INTERACTION_SELECT,
      // Both keys: occurredAt is agent-supplied and two interactions can share
      // it, so createdAt is the tiebreak that makes the timeline deterministic.
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return interactions.map((interaction) => InteractionsService.toResponse(interaction));
  }

  async create(
    customerId: string,
    dto: CreateInteractionDto,
    caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    await this.customersService.assertExists(customerId);

    const occurredAt = new Date(dto.occurredAt);

    if (occurredAt.getTime() > Date.now() + FIVE_MINUTES_MS) {
      throw new BadRequestException('occurredAt cannot be in the future.');
    }

    if (dto.ticketId) {
      await this.assertTicketBelongsToCustomer(customerId, dto.ticketId);
    }

    const created = await this.prisma.customerInteraction.create({
      data: {
        customerId,
        createdById: caller.id,
        channel: dto.channel,
        direction: dto.direction,
        subject: dto.subject.trim(),
        body: dto.body?.trim(),
        occurredAt,
        ticketId: dto.ticketId,
      },
      select: INTERACTION_SELECT,
    });

    this.logger.log(
      { actorId: caller.id, customerId, interactionId: created.id },
      'Interaction logged',
    );

    return InteractionsService.toResponse(created);
  }

  async remove(customerId: string, id: string, caller: AuthenticatedUser): Promise<void> {
    const interaction = await this.prisma.customerInteraction.findFirst({
      where: { id, customerId },
      select: { id: true, createdById: true },
    });

    if (!interaction) {
      throw new NotFoundException('Interaction not found.');
    }

    if (interaction.createdById !== caller.id && !caller.permissions.includes(ARCHIVE_PERMISSION)) {
      throw new ForbiddenException(
        'Only the author or a customer administrator can delete an interaction.',
      );
    }

    await this.prisma.customerInteraction.delete({ where: { id } });

    this.logger.log({ actorId: caller.id, customerId, interactionId: id }, 'Interaction deleted');
  }

  /**
   * Product rule 4. The schema cannot express "the ticket's customer equals the
   * interaction's customer", so this is the only thing standing between the
   * timeline and a silently wrong attribution.
   */
  private async assertTicketBelongsToCustomer(customerId: string, ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, customerId: true },
    });

    if (!ticket) {
      throw new BadRequestException('Unknown ticketId.');
    }

    if (ticket.customerId !== customerId) {
      throw new BadRequestException('That ticket belongs to a different customer.');
    }
  }

  private static toResponse(interaction: SelectedInteraction): InteractionResponseDto {
    return {
      id: interaction.id,
      customerId: interaction.customerId,
      channel: interaction.channel,
      direction: interaction.direction,
      subject: interaction.subject,
      body: interaction.body,
      occurredAt: interaction.occurredAt.toISOString(),
      createdBy: interaction.createdBy,
      createdAt: interaction.createdAt.toISOString(),
      ticketId: interaction.ticketId,
      ticket: interaction.ticket,
    };
  }
}
