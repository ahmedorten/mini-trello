import { BadRequestException } from '@nestjs/common';
import { InteractionChannel, InteractionDeliveryStatus } from '@prisma/client';
import {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelCustomerContext,
  DispatchResult,
  InboundPayload,
  NormalisedInbound,
  OutboundMessage,
} from './channel-adapter';

/** The subject synthesised for channels with no subject line of their own. */
const SYNTHETIC_SUBJECT_MAX = 80;

export abstract class BaseChannel implements ChannelAdapter {
  abstract readonly channel: InteractionChannel;
  abstract readonly capabilities: ChannelCapabilities;

  validate(message: OutboundMessage): void {
    const body = message.body?.trim() ?? '';

    if (body.length === 0) {
      throw new BadRequestException(`A ${this.channel} message needs a body.`);
    }

    const limit = this.capabilities.maxBodyLength;

    if (limit !== null && body.length > limit) {
      throw new BadRequestException(
        `A ${this.channel} message body cannot exceed ${limit} characters.`,
      );
    }
  }

  resolveAddress(message: OutboundMessage, customer: ChannelCustomerContext): string | null {
    if (this.capabilities.addressKind === 'none') {
      return null;
    }

    const raw = message.address?.trim() || this.customerAddress(customer);
    const normalised = raw ? this.normaliseAddress(raw) : null;

    if (!normalised && this.capabilities.requiresAddress) {
      throw new BadRequestException(
        `No ${this.capabilities.addressKind} address is available for a ${this.channel} message.`,
      );
    }

    return normalised;
  }

  resolveSubject(message: OutboundMessage): string {
    const explicit = message.subject?.trim();

    if (this.capabilities.supportsSubject && explicit) {
      return explicit;
    }

    // The column is NOT NULL and the timeline renders it as the entry heading,
    // so a channel with no subject line still needs one. First line, clipped.
    const firstLine = message.body.trim().split('\n')[0] ?? '';

    return firstLine.length > SYNTHETIC_SUBJECT_MAX
      ? `${firstLine.slice(0, SYNTHETIC_SUBJECT_MAX - 1)}…`
      : firstLine || this.channel;
  }

  threadKey(address: string | null, ticketId?: string): string | null {
    // A ticket is the strongest grouping signal there is: two agents replying
    // about one ticket are in one conversation even from different mailboxes.
    if (ticketId) {
      return `${this.channel}:ticket:${ticketId}`;
    }

    return address ? `${this.channel}:${address}` : null;
  }

  dispatch(): Promise<DispatchResult> {
    // No transport exists in this repo (Product rule 5). Recording it IS the
    // send. An adapter that overrides this must also flip providerConfigured,
    // and channel-registry.service.spec.ts enforces that pairing.
    return Promise.resolve({
      status: InteractionDeliveryStatus.LOGGED,
      externalId: null,
      failureReason: null,
      metadata: null,
    });
  }

  parseInbound(payload: InboundPayload): NormalisedInbound {
    if (!this.capabilities.acceptsInbound) {
      throw new BadRequestException(
        `The ${this.channel} channel does not accept inbound messages.`,
      );
    }

    const address = payload.address?.trim() ? this.normaliseAddress(payload.address.trim()) : null;

    return {
      subject: this.resolveSubject({
        subject: payload.subject,
        body: payload.body,
        occurredAt: payload.occurredAt ?? new Date(),
      }),
      body: payload.body.trim(),
      address,
      externalId: payload.externalId?.trim() || null,
      occurredAt: payload.occurredAt ?? new Date(),
      metadata: payload.metadata ?? null,
    };
  }

  /** Where this channel finds an address on the customer record. */
  protected abstract customerAddress(customer: ChannelCustomerContext): string | null;

  /** Channel-specific normalisation. Default: trim only. */
  protected normaliseAddress(raw: string): string | null {
    return raw.trim() || null;
  }

  /** Shared by SmsChannel and WhatsAppChannel — one normaliser, so the two
   *  cannot drift and split one customer's number into two thread keys. */
  protected normalisePhone(raw: string): string | null {
    const kept = raw.replace(/[^\d+]/g, '');
    const e164 = kept.startsWith('+')
      ? `+${kept.slice(1).replace(/\D/g, '')}`
      : kept.replace(/\D/g, '');
    const digits = e164.replace('+', '');

    if (digits.length < 8 || digits.length > 15) {
      throw new BadRequestException(`"${raw}" is not a usable phone number.`);
    }

    return e164;
  }
}
