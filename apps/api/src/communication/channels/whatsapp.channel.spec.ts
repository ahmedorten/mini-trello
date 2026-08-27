import { BadRequestException } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { WhatsAppChannel } from './whatsapp.channel';
import { ChannelCustomerContext, OutboundMessage } from './channel-adapter';

const OCCURRED_AT = new Date('2026-06-15T12:00:00.000Z');

function message(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return { body: 'On our way.', occurredAt: OCCURRED_AT, ...overrides };
}

const customer: ChannelCustomerContext = {
  id: 'customer-1',
  email: 'layla@crm.local',
  phone: '+201001234567',
};

describe('WhatsAppChannel', () => {
  let channel: WhatsAppChannel;

  beforeEach(() => {
    channel = new WhatsAppChannel();
  });

  it('is keyed under WHATSAPP, realtime, with a 4096-character limit', () => {
    expect(channel.channel).toBe(InteractionChannel.WHATSAPP);
    expect(channel.capabilities.isRealtime).toBe(true);
    expect(channel.capabilities.maxBodyLength).toBe(4096);
    expect(channel.capabilities.supportsSubject).toBe(false);
  });

  it('shares the SMS phone normaliser, so one number is one thread key', () => {
    expect(channel.resolveAddress(message({ address: '+20 100 123 4567' }), customer)).toBe(
      '+201001234567',
    );
  });

  it('rejects an unusable number', () => {
    expect(() => channel.resolveAddress(message({ address: '123' }), customer)).toThrow(
      BadRequestException,
    );
  });

  it('accepts 4096 characters and rejects 4097', () => {
    expect(() => channel.validate(message({ body: 'a'.repeat(4096) }))).not.toThrow();
    expect(() => channel.validate(message({ body: 'a'.repeat(4097) }))).toThrow(
      BadRequestException,
    );
  });
});
