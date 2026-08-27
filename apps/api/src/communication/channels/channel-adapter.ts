import { InteractionChannel, InteractionDeliveryStatus, Prisma } from '@prisma/client';

/** What a channel needs to know about the customer to address a message.
 *  Deliberately three fields: an adapter that needed more would be reaching
 *  into the customer record rather than describing a channel. */
export interface ChannelCustomerContext {
  id: string;
  email: string | null;
  phone: string | null;
}

/** How the counterparty is identified on a channel. Drives which input the
 *  composer renders (Story 24), and nothing else. */
export type ChannelAddressKind = 'email' | 'phone' | 'session' | 'none';

export interface ChannelCapabilities {
  /** The workspace offers a Respond composer for this channel. */
  canRespond: boolean;
  /** Conversational rather than logged-after-the-fact. Ordering hint only. */
  isRealtime: boolean;
  /** An external sender is wired up. FALSE for every adapter in this repo. */
  providerConfigured: boolean;
  /** The channel can receive through POST /api/communication/inbound/:channel. */
  acceptsInbound: boolean;
  addressKind: ChannelAddressKind;
  /** Dispatch is a 400 when no address can be resolved. */
  requiresAddress: boolean;
  /** Hard body limit, in characters, or null for "only the 8000-char DTO cap". */
  maxBodyLength: number | null;
  /** False when the channel has no subject line of its own; the adapter
   *  synthesises one from the body so the NOT NULL column stays satisfied. */
  supportsSubject: boolean;
}

export interface OutboundMessage {
  subject?: string;
  body: string;
  /** Explicit counterparty address. When absent the adapter falls back to the
   *  customer record. */
  address?: string;
  occurredAt: Date;
  ticketId?: string;
}

export interface DispatchResult {
  status: InteractionDeliveryStatus;
  externalId: string | null;
  failureReason: string | null;
  metadata: Prisma.InputJsonValue | null;
}

/** A payload handed to an adapter by the inbound route (Story 23). */
export interface InboundPayload {
  address?: string;
  subject?: string;
  body: string;
  externalId?: string;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

/** What an adapter turns an InboundPayload into. The route, not the adapter,
 *  resolves the customer and writes the row. */
export interface NormalisedInbound {
  subject: string;
  body: string;
  address: string | null;
  externalId: string | null;
  occurredAt: Date;
  metadata: Prisma.InputJsonValue | null;
}

export interface ChannelAdapter {
  readonly channel: InteractionChannel;
  readonly capabilities: ChannelCapabilities;

  /**
   * Channel-specific validation. Throws BadRequestException with a message
   * naming the channel. Called before resolveAddress so an adapter can reject
   * an over-long body without needing an address.
   */
  validate(message: OutboundMessage): void;

  /**
   * The normalised counterparty address, or null when the channel has none.
   * Throws BadRequestException when capabilities.requiresAddress is true and
   * neither the message nor the customer supplies one.
   */
  resolveAddress(message: OutboundMessage, customer: ChannelCustomerContext): string | null;

  /** The subject to store. Channels with supportsSubject: false synthesise one. */
  resolveSubject(message: OutboundMessage): string;

  /** Groups rows into one conversation. Null means "ungrouped". */
  threadKey(address: string | null, ticketId?: string): string | null;

  /** No adapter in this repo contacts anything. See ChannelCapabilities. */
  dispatch(message: OutboundMessage, address: string | null): Promise<DispatchResult>;

  /** Only meaningful when capabilities.acceptsInbound is true. */
  parseInbound(payload: InboundPayload): NormalisedInbound;
}

/** Injection token for the adapter array. One array entry per channel is the
 *  whole registration surface. */
export const CHANNEL_ADAPTERS = Symbol('CHANNEL_ADAPTERS');
