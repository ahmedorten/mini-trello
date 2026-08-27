import { Injectable } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { BaseChannel } from './base.channel';
import { ChannelCapabilities, ChannelCustomerContext } from './channel-adapter';

@Injectable()
export class SmsChannel extends BaseChannel {
  readonly channel = InteractionChannel.SMS;

  readonly capabilities: ChannelCapabilities = {
    canRespond: true,
    isRealtime: false,
    providerConfigured: false,
    acceptsInbound: true,
    addressKind: 'phone',
    requiresAddress: true,
    // 1600 is the concatenated-segment ceiling every SMS gateway shares. It
    // lives here rather than in the DTO so the DTO's @MaxLength(8000) stays the
    // one global cap.
    maxBodyLength: 1600,
    supportsSubject: false,
  };

  protected customerAddress(customer: ChannelCustomerContext): string | null {
    return customer.phone;
  }

  protected normaliseAddress(raw: string): string | null {
    return this.normalisePhone(raw);
  }
}
