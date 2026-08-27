import { BadRequestException } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { SmsChannel } from './sms.channel';
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

describe('SmsChannel', () => {
  let channel: SmsChannel;

  beforeEach(() => {
    channel = new SmsChannel();
  });

  it('is keyed under SMS with a 1600-character limit and no subject line', () => {
    expect(channel.channel).toBe(InteractionChannel.SMS);
    expect(channel.capabilities.maxBodyLength).toBe(1600);
    expect(channel.capabilities.supportsSubject).toBe(false);
    expect(channel.capabilities.addressKind).toBe('phone');
    expect(channel.capabilities.isRealtime).toBe(false);
  });

  describe('normaliseAddress (via resolveAddress)', () => {
    it('strips spaces from a spaced E.164 number', () => {
      expect(channel.resolveAddress(message({ address: '+20 100 123 4567' }), customer)).toBe(
        '+201001234567',
      );
    });

    it('rejects a three-digit number as too short', () => {
      expect(() => channel.resolveAddress(message({ address: '123' }), customer)).toThrow(
        BadRequestException,
      );
    });

    it('rejects a 20-digit number as beyond the E.164 ceiling', () => {
      expect(() =>
        channel.resolveAddress(message({ address: '12345678901234567890' }), customer),
      ).toThrow(BadRequestException);
    });

    it('falls back to customer.phone', () => {
      expect(channel.resolveAddress(message(), customer)).toBe('+201001234567');
    });
  });

  describe('validate', () => {
    it('accepts a 1600-character body', () => {
      expect(() => channel.validate(message({ body: 'a'.repeat(1600) }))).not.toThrow();
    });

    it('rejects a 1601-character body', () => {
      expect(() => channel.validate(message({ body: 'a'.repeat(1601) }))).toThrow(
        BadRequestException,
      );
    });
  });

  describe('resolveSubject', () => {
    it('synthesises from the first line, ignoring an explicit subject', () => {
      expect(
        channel.resolveSubject(message({ subject: 'Ignored', body: 'First line\nsecond line' })),
      ).toBe('First line');
    });

    it('clips and ellipsises past 80 characters', () => {
      const subject = channel.resolveSubject(message({ body: 'a'.repeat(200) }));

      expect(subject).toHaveLength(80);
      expect(subject.endsWith('…')).toBe(true);
    });
  });
});
