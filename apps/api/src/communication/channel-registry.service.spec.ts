import { BadRequestException } from '@nestjs/common';
import { InteractionChannel, InteractionDeliveryStatus } from '@prisma/client';
import { CHANNEL_ORDER, ChannelRegistryService } from './channel-registry.service';
import { ChannelAdapter } from './channels/channel-adapter';
import { EmailChannel } from './channels/email.channel';
import { LiveChatChannel } from './channels/live-chat.channel';
import { LoggedOnlyChannel } from './channels/logged-only.channel';
import { SmsChannel } from './channels/sms.channel';
import { WebFormChannel } from './channels/web-form.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';

/** The exact adapter array communication.module.ts assembles. Built here rather
 *  than imported so a module-wiring mistake shows up as a boot failure, and a
 *  registry mistake shows up here. */
function allAdapters(): ChannelAdapter[] {
  return [
    new EmailChannel(),
    new WhatsAppChannel(),
    new LiveChatChannel(),
    new SmsChannel(),
    new WebFormChannel(),
    new LoggedOnlyChannel(InteractionChannel.PHONE, false, true),
    new LoggedOnlyChannel(InteractionChannel.MEETING, false, false),
    new LoggedOnlyChannel(InteractionChannel.OTHER, true, false),
  ];
}

describe('ChannelRegistryService', () => {
  let registry: ChannelRegistryService;

  beforeEach(() => {
    registry = new ChannelRegistryService(allAdapters());
  });

  it('has an adapter for every InteractionChannel value, keyed under its own channel', () => {
    for (const value of Object.values(InteractionChannel)) {
      const adapter = registry.resolve(value);

      expect(adapter).toBeDefined();
      expect(adapter.channel).toBe(value);
    }
  });

  it('CHANNEL_ORDER has the same length as the enum and no duplicates', () => {
    const allValues = Object.values(InteractionChannel);

    expect(CHANNEL_ORDER).toHaveLength(allValues.length);
    expect(new Set(CHANNEL_ORDER).size).toBe(CHANNEL_ORDER.length);

    for (const value of allValues) {
      expect(CHANNEL_ORDER).toContain(value);
    }
  });

  it('providerConfigured is false for every adapter', () => {
    for (const value of Object.values(InteractionChannel)) {
      expect(registry.resolve(value).capabilities.providerConfigured).toBe(false);
    }
  });

  it('canRespond is false for exactly PHONE, MEETING, and WEB_FORM', () => {
    const notRespondable = Object.values(InteractionChannel).filter(
      (value) => !registry.resolve(value).capabilities.canRespond,
    );

    expect(notRespondable.sort()).toEqual(
      [InteractionChannel.PHONE, InteractionChannel.MEETING, InteractionChannel.WEB_FORM].sort(),
    );
  });

  describe('constructor guards', () => {
    it('throws, naming the channel, when an adapter is missing', () => {
      const incomplete = allAdapters().filter(
        (adapter) => adapter.channel !== InteractionChannel.SMS,
      );

      expect(() => new ChannelRegistryService(incomplete)).toThrow(/SMS/);
    });

    it('throws when two adapters claim the same channel', () => {
      const duplicated = [...allAdapters(), new EmailChannel()];

      expect(() => new ChannelRegistryService(duplicated)).toThrow(
        'Two ChannelAdapters claim the same InteractionChannel.',
      );
    });
  });

  describe('descriptors()', () => {
    it('returns eight items in CHANNEL_ORDER', () => {
      const descriptors = registry.descriptors();

      expect(descriptors).toHaveLength(8);
      expect(descriptors.map((descriptor) => descriptor.key)).toEqual(CHANNEL_ORDER);
    });

    it('each descriptor carries all nine fields', () => {
      for (const descriptor of registry.descriptors()) {
        expect(Object.keys(descriptor).sort()).toEqual(
          [
            'key',
            'canRespond',
            'isRealtime',
            'providerConfigured',
            'acceptsInbound',
            'addressKind',
            'requiresAddress',
            'maxBodyLength',
            'supportsSubject',
          ].sort(),
        );
      }
    });

    it('reports WEB_FORM as inbound-only and SMS as a 1600-character phone channel', () => {
      const byKey = new Map(registry.descriptors().map((item) => [item.key, item]));

      expect(byKey.get(InteractionChannel.WEB_FORM)).toMatchObject({
        canRespond: false,
        acceptsInbound: true,
      });
      expect(byKey.get(InteractionChannel.SMS)).toMatchObject({
        maxBodyLength: 1600,
        addressKind: 'phone',
      });
      expect(byKey.get(InteractionChannel.PHONE)).toMatchObject({
        addressKind: 'none',
        acceptsInbound: false,
      });
    });
  });

  // Product rules 5 and 6 as tested facts, not comments: no shipped adapter has
  // a transport, so no dispatch can reach QUEUED, SENT, or FAILED.
  describe('dispatch()', () => {
    it('resolves to LOGGED with no external id for every adapter except WEB_FORM', async () => {
      for (const value of Object.values(InteractionChannel)) {
        if (value === InteractionChannel.WEB_FORM) continue;

        const adapter = registry.resolve(value);

        await expect(
          adapter.dispatch({ body: 'x', occurredAt: new Date() }, null),
        ).resolves.toEqual({
          status: InteractionDeliveryStatus.LOGGED,
          externalId: null,
          failureReason: null,
          metadata: null,
        });
      }
    });

    it('WEB_FORM rejects instead', async () => {
      await expect(
        registry
          .resolve(InteractionChannel.WEB_FORM)
          .dispatch({ body: 'x', occurredAt: new Date() }, null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
