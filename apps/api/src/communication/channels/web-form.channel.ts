import { BadRequestException, Injectable } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { BaseChannel } from './base.channel';
import { ChannelCapabilities, ChannelCustomerContext, DispatchResult } from './channel-adapter';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class WebFormChannel extends BaseChannel {
  readonly channel = InteractionChannel.WEB_FORM;

  readonly capabilities: ChannelCapabilities = {
    // Product rule 4: a web form is a one-way intake. There is no "reply
    // through the form" — the reply goes out by email.
    canRespond: false,
    isRealtime: false,
    providerConfigured: false,
    acceptsInbound: true,
    addressKind: 'email',
    requiresAddress: false,
    maxBodyLength: null,
    supportsSubject: true,
  };

  protected customerAddress(customer: ChannelCustomerContext): string | null {
    return customer.email;
  }

  protected normaliseAddress(raw: string): string | null {
    const lowered = raw.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(lowered)) {
      throw new BadRequestException(`"${raw}" is not a valid email address.`);
    }

    return lowered;
  }

  async dispatch(): Promise<DispatchResult> {
    // A form is a one-way intake. Reaching here means the dispatch route
    // ignored canRespond; fail loudly rather than writing a row that claims a
    // reply went out through a form.
    throw new BadRequestException('The WEB_FORM channel cannot send; reply by email instead.');
  }
}
