import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InteractionDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CUSTOMER_REF_SELECT } from '../tickets/tickets.service';
import { ARCHIVE_PERMISSION, CustomersService, USER_REF_SELECT } from './customers.service';
import { CreateInteractionDto, InteractionResponseDto } from './dto/interaction.dto';
import { ListInteractionsQueryDto } from './dto/list-interactions-query.dto';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** The ONLY projection used for interaction responses. `metadata` is
 *  deliberately absent: Story 22 Product rule 2's diagnostic column is never
 *  projected into an API response. */
export const INTERACTION_SELECT = {
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
  deliveryStatus: true,
  channelAddress: true,
  externalId: true,
  failureReason: true,
  threadKey: true,
  customer: { select: CUSTOMER_REF_SELECT },
} satisfies Prisma.CustomerInteractionSelect;

/** Everything a channel adapter contributes to a stored interaction. Absent
 *  for the two agent-logging routes, which record LOGGED with no address. */
export interface InteractionDelivery {
  deliveryStatus?: InteractionDeliveryStatus;
  channelAddress?: string | null;
  externalId?: string | null;
  failureReason?: string | null;
  threadKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export type SelectedInteraction = Prisma.CustomerInteractionGetPayload<{
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
    if (query.deliveryStatus) where.deliveryStatus = query.deliveryStatus;

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
    caller: AuthenticatedUser | null,
    delivery: InteractionDelivery = {},
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
        // Null for a message ingested through the inbound route: no agent
        // typed it (Story 22 Product rule 3).
        createdById: caller?.id ?? null,
        channel: dto.channel,
        direction: dto.direction,
        subject: dto.subject.trim(),
        body: dto.body?.trim(),
        occurredAt,
        ticketId: dto.ticketId,
        deliveryStatus: delivery.deliveryStatus ?? InteractionDeliveryStatus.LOGGED,
        channelAddress: delivery.channelAddress ?? null,
        externalId: delivery.externalId ?? null,
        failureReason: delivery.failureReason ?? null,
        threadKey: delivery.threadKey ?? null,
        // DbNull, not JsonNull: the column means "no payload recorded", not
        // "a payload whose value is null".
        metadata: delivery.metadata ?? Prisma.DbNull,
      },
      select: INTERACTION_SELECT,
    });

    this.logger.log(
      {
        actorId: caller?.id ?? null,
        customerId,
        interactionId: created.id,
        deliveryStatus: created.deliveryStatus,
      },
      'Interaction logged',
    );

    return InteractionsService.toResponse(created);
  }

  /** One interaction by id, scoped to its customer. Mirrors remove()'s lookup
   *  but returns the full projection; the inbound route's idempotent 200 uses
   *  it so a repeat delivery returns the same body shape as the 201. */
  async findOne(customerId: string, id: string): Promise<InteractionResponseDto> {
    const interaction = await this.prisma.customerInteraction.findFirst({
      where: { id, customerId },
      select: INTERACTION_SELECT,
    });

    if (!interaction) {
      throw new NotFoundException('Interaction not found.');
    }

    return InteractionsService.toResponse(interaction);
  }

  async remove(customerId: string, id: string, caller: AuthenticatedUser): Promise<void> {
    const interaction = await this.prisma.customerInteraction.findFirst({
      where: { id, customerId },
      select: { id: true, createdById: true },
    });

    if (!interaction) {
      throw new NotFoundException('Interaction not found.');
    }

    // A null author is nobody's row: an ingested message can only be deleted by
    // an ARCHIVE_PERMISSION holder, by rule rather than by accident.
    const isAuthor = interaction.createdById !== null && interaction.createdById === caller.id;

    if (!isAuthor && !caller.permissions.includes(ARCHIVE_PERMISSION)) {
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

  /** Public so TimelineService maps the same rows the same way. Reusing this
   *  mapper is what stops the two timelines drifting in shape. */
  static toResponseList(rows: SelectedInteraction[]): InteractionResponseDto[] {
    return rows.map((row) => InteractionsService.toResponse(row));
  }

  static toResponse(interaction: SelectedInteraction): InteractionResponseDto {
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
      customer: interaction.customer,
      deliveryStatus: interaction.deliveryStatus,
      channelAddress: interaction.channelAddress,
      externalId: interaction.externalId,
      failureReason: interaction.failureReason,
      threadKey: interaction.threadKey,
    };
  }
}
