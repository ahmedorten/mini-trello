import { BadRequestException } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { LiveChatChannel } from './live-chat.channel';
import { ChannelCustomerContext, OutboundMessage } from './channel-adapter';

const OCCURRED_AT = new Date('2026-06-15T12:00:00.000Z');

function message(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return { body: 'Hello there.', occurredAt: OCCURRED_AT, ...overrides };
}

const customer: ChannelCustomerContext = {
  id: 'customer-1',
  email: 'layla@crm.local',
  phone: '+201001234567',
};

describe('LiveChatChannel', () => {
  let channel: LiveChatChannel;

  beforeEach(() => {
    channel = new LiveChatChannel();
  });

  it('is keyed under CHAT with a session address that is not required', () => {
    expect(channel.channel).toBe(InteractionChannel.CHAT);
    expect(channel.capabilities.addressKind).toBe('session');
    expect(channel.capabilities.requiresAddress).toBe(false);
    expect(channel.capabilities.isRealtime).toBe(true);
    expect(channel.capabilities.maxBodyLength).toBe(4096);
  });

  it('takes no address from the customer record — a session id lives on the session', () => {
    expect(channel.resolveAddress(message(), customer)).toBeNull();
  });

  it('passes an explicit session id through, trimmed', () => {
    expect(channel.resolveAddress(message({ address: '  session-abc  ' }), customer)).toBe(
      'session-abc',
    );
  });

  it('rejects a session id over 128 characters', () => {
    expect(() => channel.resolveAddress(message({ address: 'a'.repeat(129) }), customer)).toThrow(
      BadRequestException,
    );
  });

  it('threadKey is null when no session id was supplied', () => {
    expect(channel.threadKey(null)).toBeNull();
  });
});
