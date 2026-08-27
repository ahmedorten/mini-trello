import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import {
  listChannels,
  listCommunicationTimeline,
  listConversations,
  type ChannelDescriptor,
  type Conversation,
  type ListConversationsParams,
  type ListTimelineParams,
} from '@/api/communication';
import {
  INTERACTION_CHANNELS,
  type CustomerInteraction,
  type InteractionChannel,
  type InteractionDeliveryStatus,
  type InteractionDirection,
} from '@/api/customers';
import type { PaginationMeta } from '@/api/users';
import { toErrorMessage } from '@/api/client';

export interface ConversationSelection {
  customerId: string;
  channel: InteractionChannel;
  threadKey: string | null;
}

export const useCommunicationStore = defineStore('communication', () => {
  // The channel descriptors live here rather than in useDashboardStore: two
  // stores owning one cached list is a stale-data bug waiting for a second
  // consumer.
  const channels = ref<ChannelDescriptor[]>([]);

  const conversations = ref<Conversation[]>([]);
  const conversationsMeta = ref<PaginationMeta | null>(null);
  const isConversationsLoading = ref(false);
  const conversationsError = ref<string | null>(null);

  const interactions = ref<CustomerInteraction[]>([]);
  const timelineMeta = ref<PaginationMeta | null>(null);
  const isTimelineLoading = ref(false);
  const timelineError = ref<string | null>(null);

  const selected = ref<ConversationSelection | null>(null);

  const filters = reactive({
    page: 1,
    pageSize: 20,
    search: '',
    channel: '' as InteractionChannel | '',
    direction: '' as InteractionDirection | '',
    deliveryStatus: '' as InteractionDeliveryStatus | '',
    mine: false,
  });

  let areChannelsLoaded = false;

  async function loadChannels(): Promise<void> {
    if (areChannelsLoaded) {
      return;
    }

    areChannelsLoaded = true;

    try {
      channels.value = await listChannels();
    } catch {
      // Static metadata, and canRespond is a UI hint only (the server does not
      // enforce it on the logging routes) — failing closed here would hide the
      // Respond composer everywhere on a transient error, which is worse than
      // showing it and letting a genuinely unsupported POST fail visibly.
      // The capability defaults are permissive for the same reason: a
      // descriptor fetch failure must never BLOCK a compose.
      channels.value = INTERACTION_CHANNELS.map((key) => ({
        key,
        canRespond: true,
        isRealtime: false,
        providerConfigured: false,
        acceptsInbound: false,
        addressKind: 'none' as const,
        requiresAddress: false,
        maxBodyLength: null,
        supportsSubject: true,
      }));
    }
  }

  function channelDescriptor(key: InteractionChannel): ChannelDescriptor | undefined {
    return channels.value.find((channel) => channel.key === key);
  }

  const respondableChannels = computed(() =>
    channels.value.filter((channel) => channel.canRespond),
  );

  function conversationParams(): ListConversationsParams {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      channel: filters.channel || undefined,
      mine: filters.mine || undefined,
    };
  }

  function timelineParams(): ListTimelineParams {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      channel: filters.channel || undefined,
      direction: filters.direction || undefined,
      deliveryStatus: filters.deliveryStatus || undefined,
      mine: filters.mine || undefined,
      // A selected thread is approximated by customerId + channel: the API has
      // no threadKey filter. A customer with two threads on one channel
      // therefore shows both in the thread pane — honest, and better than a
      // filter the API does not offer.
      ...(selected.value
        ? { customerId: selected.value.customerId, channel: selected.value.channel }
        : {}),
    };
  }

  // Two independent counters. Sharing one between two lists that load
  // concurrently would let one response cancel the other's.
  let latestConversationsRequestId = 0;
  let latestTimelineRequestId = 0;

  async function loadConversations(): Promise<void> {
    const requestId = ++latestConversationsRequestId;
    isConversationsLoading.value = true;
    conversationsError.value = null;

    try {
      const result = await listConversations(conversationParams());

      if (requestId !== latestConversationsRequestId) {
        return;
      }

      conversations.value = result.items;
      conversationsMeta.value = result.meta;
    } catch (caught) {
      if (requestId !== latestConversationsRequestId) {
        return;
      }

      // A stale list must never sit next to an error message.
      conversations.value = [];
      conversationsMeta.value = null;
      conversationsError.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestConversationsRequestId) {
        isConversationsLoading.value = false;
      }
    }
  }

  async function loadTimeline(): Promise<void> {
    const requestId = ++latestTimelineRequestId;
    isTimelineLoading.value = true;
    timelineError.value = null;

    try {
      const result = await listCommunicationTimeline(timelineParams());

      if (requestId !== latestTimelineRequestId) {
        return;
      }

      interactions.value = result.items;
      timelineMeta.value = result.meta;
    } catch (caught) {
      if (requestId !== latestTimelineRequestId) {
        return;
      }

      interactions.value = [];
      timelineMeta.value = null;
      timelineError.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestTimelineRequestId) {
        isTimelineLoading.value = false;
      }
    }
  }

  function select(conversation: Conversation | ConversationSelection | null): void {
    selected.value = conversation
      ? {
          customerId:
            'customer' in conversation ? conversation.customer.id : conversation.customerId,
          channel: conversation.channel,
          threadKey: conversation.threadKey,
        }
      : null;
    filters.page = 1;
    void loadTimeline();
  }

  function setSearch(term: string): void {
    filters.search = term;
    filters.page = 1;
    void loadTimeline();
  }

  function setChannel(channel: InteractionChannel | ''): void {
    filters.channel = channel;
    filters.page = 1;
    void Promise.all([loadConversations(), loadTimeline()]);
  }

  function setDirection(direction: InteractionDirection | ''): void {
    filters.direction = direction;
    filters.page = 1;
    void loadTimeline();
  }

  function setDeliveryStatus(status: InteractionDeliveryStatus | ''): void {
    filters.deliveryStatus = status;
    filters.page = 1;
    void loadTimeline();
  }

  function setMine(mine: boolean): void {
    filters.mine = mine;
    filters.page = 1;
    void Promise.all([loadConversations(), loadTimeline()]);
  }

  function setPage(page: number): void {
    filters.page = page;
    void Promise.all([loadConversations(), loadTimeline()]);
  }

  async function refresh(): Promise<void> {
    await Promise.all([loadConversations(), loadTimeline()]);
  }

  /** Clears everything except `channels` — the descriptor cache is
   *  deployment-static, so re-fetching it on every visit is pure waste. */
  function reset(): void {
    conversations.value = [];
    conversationsMeta.value = null;
    conversationsError.value = null;
    isConversationsLoading.value = false;
    interactions.value = [];
    timelineMeta.value = null;
    timelineError.value = null;
    isTimelineLoading.value = false;
    selected.value = null;
    filters.page = 1;
    filters.search = '';
    filters.channel = '';
    filters.direction = '';
    filters.deliveryStatus = '';
    filters.mine = false;
  }

  return {
    channels,
    conversations,
    conversationsMeta,
    isConversationsLoading,
    conversationsError,
    interactions,
    timelineMeta,
    isTimelineLoading,
    timelineError,
    selected,
    filters,
    respondableChannels,
    loadChannels,
    channelDescriptor,
    loadConversations,
    loadTimeline,
    conversationParams,
    timelineParams,
    select,
    setSearch,
    setChannel,
    setDirection,
    setDeliveryStatus,
    setMine,
    setPage,
    refresh,
    reset,
  };
});
