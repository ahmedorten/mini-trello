import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { CHANNEL_ADAPTERS, ChannelAdapter } from './channels/channel-adapter';
import { ChannelDescriptorDto } from './dto/channel.dto';

/** Display order for every channel picker and filter. Moved verbatim from the
 *  deleted apps/api/src/customers/channel.registry.ts. */
export const CHANNEL_ORDER: InteractionChannel[] = [
  InteractionChannel.EMAIL,
  InteractionChannel.WHATSAPP,
  InteractionChannel.CHAT,
  InteractionChannel.SMS,
  InteractionChannel.WEB_FORM,
  InteractionChannel.PHONE,
  InteractionChannel.MEETING,
  InteractionChannel.OTHER,
];

@Injectable()
export class ChannelRegistryService {
  private readonly byChannel: Map<InteractionChannel, ChannelAdapter>;

  constructor(@Inject(CHANNEL_ADAPTERS) adapters: ChannelAdapter[]) {
    this.byChannel = new Map(adapters.map((adapter) => [adapter.channel, adapter]));

    // Boot-time exhaustiveness. A ninth enum value with no adapter must fail
    // at startup, not on the first request that happens to use it.
    const missing = Object.values(InteractionChannel).filter(
      (value) => !this.byChannel.has(value),
    );

    if (missing.length > 0) {
      throw new Error(`No ChannelAdapter registered for: ${missing.join(', ')}`);
    }

    // Without this, new Map(...) would silently keep the last adapter for a
    // duplicated channel and the first would never dispatch.
    if (this.byChannel.size !== adapters.length) {
      throw new Error('Two ChannelAdapters claim the same InteractionChannel.');
    }
  }

  resolve(channel: InteractionChannel): ChannelAdapter {
    const adapter = this.byChannel.get(channel);

    if (!adapter) {
      // Unreachable given the constructor guard; kept so the return type is
      // non-nullable for every caller.
      throw new BadRequestException(`Unsupported channel: ${channel}`);
    }

    return adapter;
  }

  descriptors(): ChannelDescriptorDto[] {
    return CHANNEL_ORDER.map((key) => ({ key, ...this.resolve(key).capabilities }));
  }
}
