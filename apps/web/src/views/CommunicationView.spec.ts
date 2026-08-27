import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia } from 'pinia';
import { reactive } from 'vue';
import CommunicationView from './CommunicationView.vue';
import { useCommunicationStore, type ConversationSelection } from '@/stores/communication';
import type { Conversation } from '@/api/communication';
import type { CustomerInteraction } from '@/api/customers';

vi.mock('@/stores/communication', () => ({ useCommunicationStore: vi.fn() }));

// The thread pane mounts the shared timeline; its own behaviour has a dedicated
// spec, so stubbing it keeps this spec about the view.
vi.mock('@/components/CommunicationTimeline.vue', () => ({
  default: {
    name: 'CommunicationTimeline',
    props: ['ticketId', 'customerId', 'readonly', 'maxItems', 'items', 'customerContact'],
    template: '<div class="communication-timeline-stub" />',
  },
}));

const mockedUseCommunicationStore = vi.mocked(useCommunicationStore);

const sampleInteraction = {
  id: 'i-1',
  customerId: 'c-1',
  channel: 'EMAIL',
  direction: 'OUTBOUND',
  subject: 'Following up',
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

function mockStore(overrides: Record<string, unknown> = {}) {
  const store = reactive({
    channels: [],
    conversations: [sampleConversation],
    conversationsMeta: META,
    isConversationsLoading: false,
    conversationsError: null as string | null,
    interactions: [sampleInteraction],
    timelineMeta: META,
    isTimelineLoading: false,
    timelineError: null as string | null,
    selected: null as { customerId: string; channel: string; threadKey: string | null } | null,
    filters: {
      page: 1,
      pageSize: 20,
      search: '',
      channel: '',
      direction: '',
      deliveryStatus: '',
      mine: false,
    },
    respondableChannels: [],
    loadChannels: vi.fn(async () => {}),
    channelDescriptor: vi.fn(),
    loadConversations: vi.fn(async () => {}),
    loadTimeline: vi.fn(async () => {}),
    // Mirrors the real store: select() sets the selection, which is what
    // syncUrl() then reads to build the query.
    select: vi.fn((conversation: Conversation | ConversationSelection | null) => {
      store.selected = conversation
        ? {
            customerId:
              'customer' in conversation ? conversation.customer.id : conversation.customerId,
            channel: conversation.channel,
            threadKey: conversation.threadKey,
          }
        : null;
    }),
    setSearch: vi.fn(),
    setChannel: vi.fn(),
    setDirection: vi.fn(),
    setDeliveryStatus: vi.fn(),
    setMine: vi.fn(),
    setPage: vi.fn(),
    refresh: vi.fn(async () => {}),
    reset: vi.fn(),
    ...overrides,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseCommunicationStore.mockReturnValue(store as any);

  return store;
}

async function mountView(initialPath = '/communication') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/communication', name: 'communication', component: CommunicationView },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
    ],
  });

  await router.push(initialPath);
  await router.isReady();

  const wrapper = mount(CommunicationView, {
    global: { plugins: [createPinia(), router], stubs: { RouterLink: RouterLinkStub } },
  });

  await flushPromises();

  return { wrapper, router };
}

describe('CommunicationView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCommunicationStore.mockReset();
  });

  it('loads channels and conversations on mount', async () => {
    const store = mockStore();
    await mountView();

    expect(store.loadChannels).toHaveBeenCalledTimes(1);
    expect(store.loadConversations).toHaveBeenCalledTimes(1);
  });

  describe('the conversations pane', () => {
    it('renders the channel label, customer name, count, and last subject', async () => {
      mockStore();
      const { wrapper } = await mountView();

      const card = wrapper.find('.communication-inbox__card');

      expect(card.text()).toContain('Email');
      expect(card.text()).toContain('Layla Ibrahim');
      expect(card.text()).toContain('3 messages');
      expect(card.text()).toContain('Following up');
    });

    it('labels a threadKey: null conversation "Earlier history" rather than hiding it', async () => {
      mockStore({
        conversations: [{ ...sampleConversation, threadKey: null }],
      });
      const { wrapper } = await mountView();

      expect(wrapper.find('.communication-inbox__card-thread').text()).toBe('Earlier history');
    });

    it('renders its loading state', async () => {
      mockStore({ conversations: [], isConversationsLoading: true });
      const { wrapper } = await mountView();

      expect(wrapper.text()).toContain('Loading');
    });

    it('renders its error state', async () => {
      mockStore({ conversations: [], conversationsError: 'conversations down' });
      const { wrapper } = await mountView();

      expect(wrapper.text()).toContain('conversations down');
    });

    it('renders its empty state', async () => {
      mockStore({ conversations: [] });
      const { wrapper } = await mountView();

      expect(wrapper.text()).toContain('No conversations match these filters.');
    });
  });

  describe('selection', () => {
    it('clicking a card calls select and writes the three query parameters', async () => {
      const store = mockStore();
      const { wrapper, router } = await mountView();

      await wrapper.find('.communication-inbox__card').trigger('click');
      await flushPromises();

      expect(store.select).toHaveBeenCalledWith(sampleConversation);
      expect(router.currentRoute.value.query).toEqual({
        customerId: 'c-1',
        channel: 'EMAIL',
        thread: 'EMAIL:layla@crm.local',
      });
    });

    it('uses replace, not push, so the back stack does not fill up', async () => {
      mockStore();
      const { wrapper, router } = await mountView();
      const replaceSpy = vi.spyOn(router, 'replace');

      await wrapper.find('.communication-inbox__card').trigger('click');
      await flushPromises();

      expect(replaceSpy).toHaveBeenCalledTimes(1);
    });

    it('restores a selection from the query on mount', async () => {
      const store = mockStore();
      await mountView('/communication?customerId=c-9&channel=SMS&thread=SMS%3A%2B201001234567');

      expect(store.select).toHaveBeenCalledWith({
        customerId: 'c-9',
        channel: 'SMS',
        threadKey: 'SMS:+201001234567',
      });
    });

    it('restores a null-thread selection when the query omits thread', async () => {
      const store = mockStore();
      await mountView('/communication?customerId=c-9&channel=SMS');

      expect(store.select).toHaveBeenCalledWith({
        customerId: 'c-9',
        channel: 'SMS',
        threadKey: null,
      });
    });

    it('does not select when the query carries no selection', async () => {
      const store = mockStore();
      await mountView();

      expect(store.select).not.toHaveBeenCalled();
    });
  });

  describe('the thread pane', () => {
    it('prompts for a selection when nothing is selected', async () => {
      mockStore();
      const { wrapper } = await mountView();

      expect(wrapper.text()).toContain('Select a conversation to read it.');
      expect(wrapper.findComponent({ name: 'CommunicationTimeline' }).exists()).toBe(false);
    });

    it('mounts the shared timeline with the store rows when something is selected', async () => {
      mockStore({
        selected: { customerId: 'c-1', channel: 'EMAIL', threadKey: 'EMAIL:layla@crm.local' },
      });
      const { wrapper } = await mountView();

      const timeline = wrapper.findComponent({ name: 'CommunicationTimeline' });

      expect(timeline.exists()).toBe(true);
      expect(timeline.props('customerId')).toBe('c-1');
      expect(timeline.props('items')).toEqual([sampleInteraction]);
    });

    it('renders its own error state without touching the conversations pane', async () => {
      mockStore({
        selected: { customerId: 'c-1', channel: 'EMAIL', threadKey: 'EMAIL:layla@crm.local' },
        timelineError: 'timeline down',
      });
      const { wrapper } = await mountView();

      expect(wrapper.text()).toContain('timeline down');
      expect(wrapper.find('.communication-inbox__card').exists()).toBe(true);
    });
  });

  describe('filters', () => {
    it('the search input debounces into setSearch', async () => {
      vi.useFakeTimers();
      const store = mockStore();
      const { wrapper } = await mountView();

      const input = wrapper.find('input[type="search"]');
      await input.setValue('q');
      await input.setValue('qu');
      await input.setValue('quo');

      expect(store.setSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(store.setSearch).toHaveBeenCalledTimes(1);
      expect(store.setSearch).toHaveBeenCalledWith('quo');
      vi.useRealTimers();
    });

    it('each select and the checkbox reach their own setter', async () => {
      const store = mockStore();
      const { wrapper } = await mountView();

      const selects = wrapper.findAll('.communication-inbox__filters select');
      await selects[0].setValue('EMAIL');
      await selects[1].setValue('INBOUND');
      await selects[2].setValue('RECEIVED');
      await wrapper.find('.communication-inbox__filters input[type="checkbox"]').setValue(true);

      expect(store.setChannel).toHaveBeenCalledWith('EMAIL');
      expect(store.setDirection).toHaveBeenCalledWith('INBOUND');
      expect(store.setDeliveryStatus).toHaveBeenCalledWith('RECEIVED');
      expect(store.setMine).toHaveBeenCalledWith(true);
    });
  });

  it('both paginations emit into setPage', async () => {
    const store = mockStore({
      conversationsMeta: { page: 1, pageSize: 20, total: 60, totalPages: 3 },
      timelineMeta: { page: 1, pageSize: 20, total: 60, totalPages: 3 },
      selected: { customerId: 'c-1', channel: 'EMAIL', threadKey: 'EMAIL:layla@crm.local' },
    });
    const { wrapper } = await mountView();

    const paginations = wrapper.findAllComponents({ name: 'AppPagination' });
    expect(paginations).toHaveLength(2);

    paginations[0].vm.$emit('change', 2);
    paginations[1].vm.$emit('change', 3);

    expect(store.setPage).toHaveBeenCalledWith(2);
    expect(store.setPage).toHaveBeenCalledWith(3);
  });

  it('Refresh reloads both panes', async () => {
    const store = mockStore();
    const { wrapper } = await mountView();

    await wrapper.findAll('button').find((button) => button.text() === 'Refresh')!.trigger('click');

    expect(store.refresh).toHaveBeenCalledTimes(1);
  });

  it('nothing polls: no interval or timer-driven refresh is registered', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    mockStore();
    await mountView();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
