import { BadRequestException, Injectable } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { BaseChannel } from './base.channel';
import { ChannelCapabilities } from './channel-adapter';

const SESSION_ID_MAX = 128;

@Injectable()
export class LiveChatChannel extends BaseChannel {
  readonly channel = InteractionChannel.CHAT;

  readonly capabilities: ChannelCapabilities = {
    canRespond: true,
    isRealtime: true,
    providerConfigured: false,
    acceptsInbound: true,
    addressKind: 'session',
    requiresAddress: false,
    maxBodyLength: 4096,
    supportsSubject: false,
  };

  /** A chat session id lives on the session, not the customer record. */
  protected customerAddress(): string | null {
    return null;
  }

  protected normaliseAddress(raw: string): string | null {
    const trimmed = raw.trim();

    if (trimmed.length > SESSION_ID_MAX) {
      throw new BadRequestException(
        `A CHAT session id cannot exceed ${SESSION_ID_MAX} characters.`,
      );
    }

    return trimmed || null;
  }
}
