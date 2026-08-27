import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CustomerStatus,
  InteractionChannel,
  InteractionDeliveryStatus,
  InteractionDirection,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CustomersService } from '../customers/customers.service';
import { InteractionResponseDto } from '../customers/dto/interaction.dto';
import { InteractionsService } from '../customers/interactions.service';
import { ChannelRegistryService } from './channel-registry.service';
import { ChannelCustomerContext, OutboundMessage } from './channels/channel-adapter';
import { InboundMessageDto } from './dto/inbound-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

/** A permission constant lives next to the service that enforces it. */
export const COMMUNICATION_SEND_PERMISSION = 'communication:send';

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelRegistryService,
    private readonly interactions: InteractionsService,
    private readonly customersService: CustomersService,
  ) {}

  async send(dto: SendMessageDto, caller: AuthenticatedUser): Promise<InteractionResponseDto> {
    const adapter = this.registry.resolve(dto.channel);

    if (!adapter.capabilities.canRespond) {
      throw new BadRequestException(`The ${dto.channel} channel cannot send.`);
    }

    const customer = await this.customerContext(dto.customerId);

    const message: OutboundMessage = {
      subject: dto.subject,
      body: dto.body,
      address: dto.address,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      ticketId: dto.ticketId,
    };

    // Order matters: validate can reject an over-long body before an address is
    // needed, which produces the more useful of the two 400s.
    adapter.validate(message);

    const address = adapter.resolveAddress(message, customer);
    const subject = adapter.resolveSubject(message);
    const threadKey = adapter.threadKey(address, dto.ticketId);
    const result = await adapter.dispatch(message, address);

    // Through InteractionsService, never prisma directly: that is what keeps the
    // future-occurredAt and ticket-belongs-to-customer guards on this path too.
    // The subject handed over is the ADAPTER-resolved one, so a channel with
    // supportsSubject: false still satisfies the NOT NULL column and
    // CreateInteractionDto's @MinLength(2).
    const interaction = await this.interactions.create(
      dto.customerId,
      {
        channel: dto.channel,
        direction: InteractionDirection.OUTBOUND,
        subject,
        body: dto.body.trim(),
        occurredAt: message.occurredAt.toISOString(),
        ticketId: dto.ticketId,
      },
      caller,
      {
        deliveryStatus: result.status,
        channelAddress: address,
        externalId: result.externalId,
        failureReason: result.failureReason,
        threadKey,
        metadata: result.metadata,
      },
    );

    this.logger.log(
      {
        actorId: caller.id,
        customerId: dto.customerId,
        channel: dto.channel,
        deliveryStatus: result.status,
        interactionId: interaction.id,
      },
      'Message dispatched',
    );

    return interaction;
  }

  async ingest(
    channel: InteractionChannel,
    dto: InboundMessageDto,
  ): Promise<{ interaction: InteractionResponseDto; created: boolean }> {
    const adapter = this.registry.resolve(channel);

    if (!adapter.capabilities.acceptsInbound) {
      throw new BadRequestException(`The ${channel} channel does not accept inbound messages.`);
    }

    const normalised = adapter.parseInbound({
      address: dto.address,
      subject: dto.subject,
      body: dto.body,
      externalId: dto.externalId,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
    });

    // Product rule 5. Checked before the customer lookup so a retry costs one
    // indexed read and nothing else.
    if (normalised.externalId) {
      const duplicate = await this.findByExternalId(channel, normalised.externalId);

      if (duplicate) {
        return duplicate;
      }
    }

    const customerId = await this.resolveInboundCustomer(channel, dto, normalised.address);

    try {
      // caller is null — that is the whole reason Story 22 made createdById
      // nullable. No agent typed this message.
      const interaction = await this.interactions.create(
        customerId,
        {
          channel,
          direction: InteractionDirection.INBOUND,
          subject: normalised.subject,
          body: normalised.body,
          occurredAt: normalised.occurredAt.toISOString(),
          ticketId: dto.ticketId,
        },
        null,
        {
          deliveryStatus: InteractionDeliveryStatus.RECEIVED,
          channelAddress: normalised.address,
          externalId: normalised.externalId,
          failureReason: null,
          threadKey: adapter.threadKey(normalised.address, dto.ticketId),
          metadata: normalised.metadata,
        },
      );

      this.logger.log(
        {
          customerId,
          channel,
          externalId: normalised.externalId,
          interactionId: interaction.id,
        },
        'Inbound message ingested',
      );

      return { interaction, created: true };
    } catch (error) {
      // The pre-check above is not transactional, so two concurrent deliveries
      // with one externalId can both pass it. Webhook senders retry in bursts,
      // so this is a real race, not a theoretical one: fall back to the
      // idempotent path rather than returning a 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        normalised.externalId
      ) {
        const duplicate = await this.findByExternalId(channel, normalised.externalId);

        if (duplicate) {
          return duplicate;
        }
      }

      throw error;
    }
  }

  /** A stored row for this (channel, externalId), if any. The @@unique index
   *  from Story 22 makes this a lookup, not a scan. */
  private async findByExternalId(
    channel: InteractionChannel,
    externalId: string,
  ): Promise<{ interaction: InteractionResponseDto; created: boolean } | null> {
    const existing = await this.prisma.customerInteraction.findUnique({
      where: { channel_externalId: { channel, externalId } },
      select: { id: true, customerId: true },
    });

    if (!existing) {
      return null;
    }

    this.logger.log({ channel, externalId }, 'Duplicate inbound ignored');

    return {
      interaction: await this.interactions.findOne(existing.customerId, existing.id),
      created: false,
    };
  }

  /**
   * Product rule 6. An explicit id is trusted over an address; an address that
   * matches nothing is a 404, because a webhook needs a machine-readable signal
   * that the message was not filed.
   */
  private async resolveInboundCustomer(
    channel: InteractionChannel,
    dto: InboundMessageDto,
    address: string | null,
  ): Promise<string> {
    if (dto.customerId) {
      const { id } = await this.customersService.assertExists(dto.customerId);

      return id;
    }

    if (!address) {
      throw new BadRequestException('Either customerId or address is required.');
    }

    const addressKind = this.registry.resolve(channel).capabilities.addressKind;

    if (addressKind === 'session' || addressKind === 'none') {
      // No customer record holds a session id, so there is nothing to match on.
      // Do NOT silently create an unattached interaction.
      throw new BadRequestException(`A ${channel} message must supply customerId.`);
    }

    const match = await this.prisma.customer.findFirst({
      where:
        addressKind === 'email'
          ? { email: address }
          : { OR: [{ phone: address }, { alternatePhone: address }] },
      select: { id: true },
    });

    if (!match) {
      throw new NotFoundException('No customer matches that address.');
    }

    // A match by address rather than by customerId can mis-file: two customers
    // can share a phone number, and findFirst then takes one arbitrarily. Log it
    // so the mis-file is at least traceable.
    this.logger.warn(
      { channel, address, customerId: match.id },
      'Inbound message filed by address match, not by customerId',
    );

    return match.id;
  }

  /** Product rule 7: dispatching to an archived customer is almost certainly a
   *  mistake and is cheap to prevent. (Ingestion does not go through here —
   *  refusing to RECORD a message they sent us would lose data.) */
  private async customerContext(customerId: string): Promise<ChannelCustomerContext> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, email: true, phone: true, status: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    if (customer.status === CustomerStatus.ARCHIVED) {
      throw new BadRequestException('That customer is archived.');
    }

    return { id: customer.id, email: customer.email, phone: customer.phone };
  }
}
