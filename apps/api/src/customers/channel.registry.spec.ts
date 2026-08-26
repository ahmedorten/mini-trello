import { InteractionChannel } from '@prisma/client';
import { CHANNEL_ORDER, CHANNEL_REGISTRY } from './channel.registry';

describe('CHANNEL_REGISTRY / CHANNEL_ORDER', () => {
  it('has a CHANNEL_REGISTRY entry for every InteractionChannel value', () => {
    for (const value of Object.values(InteractionChannel)) {
      expect(CHANNEL_REGISTRY[value]).toBeDefined();
      expect(CHANNEL_REGISTRY[value].key).toBe(value);
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

  it('providerConfigured is false for every channel', () => {
    for (const value of Object.values(InteractionChannel)) {
      expect(CHANNEL_REGISTRY[value].providerConfigured).toBe(false);
    }
  });

  it('canRespond is false for exactly PHONE and MEETING', () => {
    const notRespondable = Object.values(InteractionChannel).filter(
      (value) => !CHANNEL_REGISTRY[value].canRespond,
    );

    expect(notRespondable.sort()).toEqual(
      [InteractionChannel.PHONE, InteractionChannel.MEETING].sort(),
    );
  });
});
