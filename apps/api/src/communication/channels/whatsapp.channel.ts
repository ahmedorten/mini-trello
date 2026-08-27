import { Injectable } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { BaseChannel } from './base.channel';
import { ChannelCapabilities, ChannelCustomerContext } from './channel-adapter';

@Injectable()
export class WhatsAppChannel extends BaseChannel {
  readonly channel = InteractionChannel.WHATSAPP;

  readonly capabilities: ChannelCapabilities = {
    canRespond: true,
    isRealtime: true,
    providerConfigured: false,
    acceptsInbound: true,
    addressKind: 'phone',
    requiresAddress: true,
    maxBodyLength: 4096,
    supportsSubject: false,
  };

  protected customerAddress(customer: ChannelCustomerContext): string | null {
    return customer.phone;
  }

  // The same normaliser SmsChannel uses, so one customer's number cannot split
  // into two thread keys across the two channels.
  protected normaliseAddress(raw: string): string | null {
    return this.normalisePhone(raw);
  }
}
