import { InteractionChannel } from '@prisma/client';
import { BaseChannel } from './base.channel';
import { ChannelCapabilities } from './channel-adapter';

/**
 * One class covering PHONE, MEETING, and OTHER: three channels with no address,
 * no transport, and no inbound route — only a record that they happened.
 *
 * Deliberately NOT @Injectable(): it takes constructor arguments Nest cannot
 * resolve, which is why communication.module.ts provides its instances through
 * the CHANNEL_ADAPTERS factory rather than the DI container.
 */
export class LoggedOnlyChannel extends BaseChannel {
  readonly capabilities: ChannelCapabilities;

  constructor(
    readonly channel: InteractionChannel,
    canRespond: boolean,
    isRealtime: boolean,
  ) {
    super();

    this.capabilities = {
      canRespond,
      isRealtime,
      providerConfigured: false,
      acceptsInbound: false,
      addressKind: 'none',
      requiresAddress: false,
      maxBodyLength: null,
      supportsSubject: true,
    };
  }

  protected customerAddress(): string | null {
    return null;
  }
}
