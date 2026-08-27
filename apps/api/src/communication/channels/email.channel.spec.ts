import { BadRequestException } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { EmailChannel } from './email.channel';
import { ChannelCustomerContext, OutboundMessage } from './channel-adapter';

const OCCURRED_AT = new Date('2026-06-15T12:00:00.000Z');

function message(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return { body: 'We are on it.', occurredAt: OCCURRED_AT, ...overrides };
}

const customer: ChannelCustomerContext = {
  id: 'customer-1',
  email: 'Layla@CRM.local',
  phone: '+201001234567',
};

describe('EmailChannel', () => {
  let channel: EmailChannel;

  beforeEach(() => {
    channel = new EmailChannel();
  });

  it('is keyed under EMAIL and reports no configured provider', () => {
    expect(channel.channel).toBe(InteractionChannel.EMAIL);
    expect(channel.capabilities.providerConfigured).toBe(false);
    expect(channel.capabilities.canRespond).toBe(true);
    expect(channel.capabilities.requiresAddress).toBe(true);
  });

  describe('validate', () => {
    it('rejects an empty body', () => {
      expect(() => channel.validate(message({ body: '' }))).toThrow(BadRequestException);
    });

    it('rejects a whitespace-only body', () => {
      expect(() => channel.validate(message({ body: '   ' }))).toThrow(BadRequestException);
    });

    it('accepts a long body — EMAIL has no channel limit', () => {
      expect(() => channel.validate(message({ body: 'a'.repeat(7999) }))).not.toThrow();
    });
  });

  describe('resolveAddress', () => {
    it('lower-cases so one mailbox cannot become two thread keys', () => {
      expect(channel.resolveAddress(message({ address: 'Nour@X.com' }), customer)).toBe(
        'nour@x.com',
      );
    });

    it('falls back to customer.email', () => {
      expect(channel.resolveAddress(message(), customer)).toBe('layla@crm.local');
    });

    it('prefers an explicit message address over the customer record', () => {
      expect(channel.resolveAddress(message({ address: 'other@crm.local' }), customer)).toBe(
        'other@crm.local',
      );
    });

    it('throws when neither the message nor the customer supplies one', () => {
      expect(() => channel.resolveAddress(message(), { ...customer, email: null })).toThrow(
        BadRequestException,
      );
    });

    it('throws on a malformed address', () => {
      expect(() => channel.resolveAddress(message({ address: 'not-an-email' }), customer)).toThrow(
        BadRequestException,
      );
    });
  });

  it('resolveSubject returns the explicit subject', () => {
    expect(channel.resolveSubject(message({ subject: '  Following up  ' }))).toBe('Following up');
  });

  describe('threadKey', () => {
    it('prefers the ticket when one is present', () => {
      expect(channel.threadKey('nour@x.com', 'ticket-1')).toBe('EMAIL:ticket:ticket-1');
    });

    it('falls back to the address', () => {
      expect(channel.threadKey('nour@x.com')).toBe('EMAIL:nour@x.com');
    });

    it('is null with neither', () => {
      expect(channel.threadKey(null)).toBeNull();
    });
  });
});
