import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCommunicationStore } from './communication';
import {
  listChannels,
  listCommunicationTimeline,
  listConversations,
  type ChannelDescriptor,
  type Conversation,
} from '@/api/communication';
import type { CustomerInteraction } from '@/api/customers';

vi.mock('@/api/communication', () => ({
  listChannels: vi.fn(),
  listCommunicationTimeline: vi.fn(),
  listConversations: vi.fn(),
}));

const mockedListChannels = vi.mocked(listChannels);
const mockedListTimeline = vi.mocked(listCommunicationTimeline);
const mockedListConversations = vi.mocked(listConversations);

const sampleChannel: ChannelDescriptor = {
  key: 'EMAIL',
  canRespond: true,
  isRealtime: false,
  providerConfigured: false,
  acceptsInbound: true,
  addressKind: 'email',
  requiresAddress: true,
  maxBodyLength: null,
  supportsSubject: true,
};

const sampleInteraction = {
  id: 'i-1',
  customerId: 'c-1',
  channel: 'EMAIL',
  direction: 'OUTBOUND',
  subject: 'Follow-up',
  body: 'We are on it.',
  occurredAt: '2026-08-25T00:00:00.000Z',
  createdBy: null,
  createdAt: '2026-08-25T00:00:00.000Z',
  ticketId: null,
  ticket: null,
  customer: { id: 'c-1', name: 'Layla Ibrahim', email: 'layla@crm.local' },
  deliveryStatus: 'LOGGED',
  channelAddress: 'layla@crm.local',
  externalId: null,
  failureReason: null,
  threadKey: 'EMAIL:layla@crm.local',
} as CustomerInteraction;

const sampleConversation: Conversation = {
  customer: { id: 'c-1', name: 'Layla Ibrahim', email: 'layla@crm.local' },
  channel: 'EMAIL',
  threadKey: 'EMAIL:layla@crm.local',
  messageCount: 3,
  lastOccurredAt: '2026-08-25T00:00:00.000Z',
  lastMessage: sampleInteraction,
};

const META = { page: 1, pageSize: 20, total: 1, totalPages: 1 };

describe('useCommunicationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedListTimeline.mockResolvedValue({ items: [sampleInteraction], meta: META });
    mockedListConversations.mockResolvedValue({ items: [sampleConversation], meta: META });
  });

  describe('loadChannels', () => {
    it('populates channels on success', async () => {
      mockedListChannels.mockResolvedValue([sampleChannel]);
      const store = useCommunicationStore();

      await store.loadChannels();

      expect(store.channels).toEqual([sampleChannel]);
    });

    it('caches after one call — the latch', async () => {
      mockedListChannels.mockResolvedValue([sampleChannel]);
      const store = useCommunicationStore();

      await store.loadChannels();
      await store.loadChannels();

      expect(mockedListChannels).toHaveBeenCalledTimes(1);
    });

    it('falls back to permissive descriptors on rejection, so a fetch failure never blocks a compose', async () => {
      mockedListChannels.mockRejectedValue(new Error('forbidden'));
      const store = useCommunicationStore();

      await store.loadChannels();

      expect(store.channels.length).toBeGreaterThan(0);
      expect(store.channels.every((channel) => channel.canRespond)).toBe(true);
      expect(store.channels.every((channel) => !channel.requiresAddress)).toBe(true);
      expect(store.channels.every((channel) => channel.supportsSubject)).toBe(true);
    });

    it('channelDescriptor looks a descriptor up by key', async () => {
      mockedListChannels.mockResolvedValue([sampleChannel]);
      const store = useCommunicationStore();

      await store.loadChannels();

      expect(store.channelDescriptor('EMAIL')).toEqual(sampleChannel);
      expect(store.channelDescriptor('SMS')).toBeUndefined();
    });

    it('respondableChannels filters on canRespond', async () => {
      mockedListChannels.mockResolvedValue([
        sampleChannel,
        { ...sampleChannel, key: 'WEB_FORM', canRespond: false },
      ]);
      const store = useCommunicationStore();

      await store.loadChannels();

      expect(store.respondableChannels.map((channel) => channel.key)).toEqual(['EMAIL']);
    });
  });

  describe('the two loads are independent', () => {
    it('a conversations failure clears its own list and error without touching the timeline', async () => {
      mockedListConversations.mockRejectedValue(new Error('conversations down'));
      const store = useCommunicationStore();

      await store.loadTimeline();
      await store.loadConversations();

      expect(store.conversationsError).toBe('conversations down');
      expect(store.conversations).toEqual([]);
      expect(store.conversationsMeta).toBeNull();
      expect(store.timelineError).toBeNull();
      expect(store.interactions).toEqual([sampleInteraction]);
    });

    it('a timeline failure clears its own list and error without touching conversations', async () => {
      mockedListTimeline.mockRejectedValue(new Error('timeline down'));
      const store = useCommunicationStore();

      await store.loadConversations();
      await store.loadTimeline();

      expect(store.timelineError).toBe('timeline down');
      expect(store.interactions).toEqual([]);
      expect(store.timelineMeta).toBeNull();
      expect(store.conversationsError).toBeNull();
      expect(store.conversations).toEqual([sampleConversation]);
    });
  });

  it('discards a stale timeline response when two loads resolve out of order', async () => {
    const store = useCommunicationStore();
    let resolveFirst: (value: { items: CustomerInteraction[]; meta: typeof META }) => void = () => {};

    mockedListTimeline
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        items: [{ ...sampleInteraction, id: 'i-second' }],
        meta: META,
      });

    const first = store.loadTimeline();
    const second = store.loadTimeline();

    await second;
    resolveFirst({ items: [{ ...sampleInteraction, id: 'i-first' }], meta: META });
    await first;

    expect(store.interactions.map((item) => item.id)).toEqual(['i-second']);
  });

  describe('filters', () => {
    it('setChannel resets page to 1', async () => {
      const store = useCommunicationStore();
      store.filters.page = 4;

      store.setChannel('SMS');

      expect(store.filters.channel).toBe('SMS');
      expect(store.filters.page).toBe(1);
    });

    it('setSearch, setDirection, setDeliveryStatus, and setMine each reset page to 1', () => {
      const store = useCommunicationStore();

      for (const apply of [
        () => store.setSearch('quote'),
        () => store.setDirection('INBOUND'),
        () => store.setDeliveryStatus('RECEIVED'),
        () => store.setMine(true),
      ]) {
        store.filters.page = 7;
        apply();
        expect(store.filters.page).toBe(1);
      }
    });

    it('setPage does NOT reset the page', () => {
      const store = useCommunicationStore();

      store.setPage(3);

      expect(store.filters.page).toBe(3);
    });

    it("timelineParams maps '' to undefined", () => {
      const store = useCommunicationStore();

      expect(store.timelineParams()).toEqual({
        page: 1,
        pageSize: 20,
        search: undefined,
        channel: undefined,
        direction: undefined,
        deliveryStatus: undefined,
        mine: undefined,
      });
    });
  });

  describe('select', () => {
    it('sets the selection, resets the page, and reloads the timeline', async () => {
      const store = useCommunicationStore();
      store.filters.page = 5;

      store.select(sampleConversation);
      await Promise.resolve();

      expect(store.selected).toEqual({
        customerId: 'c-1',
        channel: 'EMAIL',
        threadKey: 'EMAIL:layla@crm.local',
      });
      expect(store.filters.page).toBe(1);
      expect(mockedListTimeline).toHaveBeenCalled();
    });

    it('folds the selection into the timeline params as customerId + channel only', () => {
      const store = useCommunicationStore();

      store.select(sampleConversation);

      // The API has no threadKey filter, so a selected thread is approximated.
      expect(store.timelineParams()).toEqual(
        expect.objectContaining({ customerId: 'c-1', channel: 'EMAIL' }),
      );
      expect(store.timelineParams()).not.toHaveProperty('threadKey');
    });

    it('select(null) clears the selection', () => {
      const store = useCommunicationStore();

      store.select(sampleConversation);
      store.select(null);

      expect(store.selected).toBeNull();
    });
  });

  it('reset clears everything except the deployment-static channel cache', async () => {
    mockedListChannels.mockResolvedValue([sampleChannel]);
    const store = useCommunicationStore();

    await store.loadChannels();
    await store.loadConversations();
    await store.loadTimeline();
    store.select(sampleConversation);

    store.reset();

    expect(store.channels).toEqual([sampleChannel]);
    expect(store.conversations).toEqual([]);
    expect(store.interactions).toEqual([]);
    expect(store.selected).toBeNull();
    expect(store.filters.page).toBe(1);
    expect(store.filters.search).toBe('');
  });
});
