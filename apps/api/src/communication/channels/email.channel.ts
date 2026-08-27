import { BadRequestException, Injectable } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { BaseChannel } from './base.channel';
import { ChannelCapabilities, ChannelCustomerContext } from './channel-adapter';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmailChannel extends BaseChannel {
  readonly channel = InteractionChannel.EMAIL;

  readonly capabilities: ChannelCapabilities = {
    canRespond: true,
    isRealtime: false,
    providerConfigured: false,
    acceptsInbound: true,
    addressKind: 'email',
    requiresAddress: true,
    maxBodyLength: null,
    supportsSubject: true,
  };

  protected customerAddress(customer: ChannelCustomerContext): string | null {
    return customer.email;
  }

  // Lower-casing matters: the thread key is built from the address, so
  // Nour@x.com and nour@x.com must not split one conversation in two.
  protected normaliseAddress(raw: string): string | null {
    const lowered = raw.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(lowered)) {
      throw new BadRequestException(`"${raw}" is not a valid email address.`);
    }

    return lowered;
  }
}
