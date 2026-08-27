import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { getAgentDashboard, type AgentDashboard, type TicketScope } from '@/api/dashboard';
import { listChannels, type ChannelDescriptor } from '@/api/communication';
import { INTERACTION_CHANNELS } from '@/api/customers';
import {
  listTickets,
  type ListTicketsParams,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from '@/api/tickets';
import type { PaginationMeta } from '@/api/users';
import { toErrorMessage } from '@/api/client';

export const useDashboardStore = defineStore('dashboard', () => {
  const dashboard = ref<AgentDashboard | null>(null);
  const scope = ref<TicketScope>('mine');
  const channels = ref<ChannelDescriptor[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // The workspace queue is deliberately its own state (Story 18/21 Product
  // rule 7): TicketsView.vue and the workspace are mounted independently and
  // hold different filters. Sharing useTicketsStore.filters here would mean
  // opening the workspace silently rewrites the tickets page's filters.
  const queueItems = ref<Ticket[]>([]);
  const queueMeta = ref<PaginationMeta | null>(null);
  const isQueueLoading = ref(false);
  const queueError = ref<string | null>(null);

  const queueFilters = reactive({
    page: 1,
    pageSize: 20,
    search: '',
    status: '' as TicketStatus | '',
    priority: '' as TicketPriority | '',
    scope: 'workable' as TicketScope,
  });

  function queueParams(): ListTicketsParams {
    return {
      page: queueFilters.page,
      pageSize: queueFilters.pageSize,
      search: queueFilters.search || undefined,
      status: queueFilters.status || undefined,
      priority: queueFilters.priority || undefined,
      scope: queueFilters.scope,
    };
  }

  let latestRequestId = 0;

  async function load(): Promise<void> {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    error.value = null;

    try {
      const result = await getAgentDashboard(scope.value);

      if (requestId !== latestRequestId) {
        return;
      }

      dashboard.value = result;
    } catch (caught) {
      if (requestId !== latestRequestId) {
        return;
      }

      // A stale dashboard must never sit next to an error message.
      dashboard.value = null;
      error.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestRequestId) {
        isLoading.value = false;
      }
    }
  }

  function setScope(next: TicketScope): void {
    scope.value = next;
    void load();
  }

  let areChannelsLoaded = false;

  async function loadChannels(): Promise<void> {
    if (areChannelsLoaded) {
      return;
    }

    areChannelsLoaded = true;

    try {
      channels.value = await listChannels();
    } catch {
      // Static metadata, and canRespond is a UI hint only (Story 19 does not
      // enforce it server-side) — failing closed here would hide the Respond
      // composer everywhere on a transient error, which is worse than
      // showing it and letting a genuinely unsupported POST fail visibly.
      channels.value = INTERACTION_CHANNELS.map((key) => ({
        key,
        canRespond: true,
        isRealtime: false,
        providerConfigured: false,
      }));
    }
  }

  // A third, independent counter: `load()` and `loadQueue()` are both
  // list-ish reads that can be in flight at once, and sharing either of
  // their counters would let one screen's response cancel the other's.
  let latestQueueRequestId = 0;

  async function loadQueue(): Promise<void> {
    const requestId = ++latestQueueRequestId;
    isQueueLoading.value = true;
    queueError.value = null;

    try {
      const result = await listTickets(queueParams());

      if (requestId !== latestQueueRequestId) {
        return;
      }

      queueItems.value = result.items;
      queueMeta.value = result.meta;
    } catch (caught) {
      if (requestId !== latestQueueRequestId) {
        return;
      }

      queueItems.value = [];
      queueMeta.value = null;
      queueError.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestQueueRequestId) {
        isQueueLoading.value = false;
      }
    }
  }

  function setQueueSearch(term: string): void {
    queueFilters.search = term;
    queueFilters.page = 1;
    void loadQueue();
  }

  function setQueueScope(next: TicketScope): void {
    queueFilters.scope = next;
    queueFilters.page = 1;
    void loadQueue();
  }

  function setQueueStatusFilter(status: TicketStatus | ''): void {
    queueFilters.status = status;
    queueFilters.page = 1;
    void loadQueue();
  }

  function setQueuePriorityFilter(priority: TicketPriority | ''): void {
    queueFilters.priority = priority;
    queueFilters.page = 1;
    void loadQueue();
  }

  function setQueuePage(page: number): void {
    queueFilters.page = page;
    void loadQueue();
  }

  async function refresh(): Promise<void> {
    await Promise.all([load(), loadQueue()]);
  }

  return {
    dashboard,
    scope,
    channels,
    isLoading,
    error,
    queueItems,
    queueMeta,
    queueFilters,
    isQueueLoading,
    queueError,
    load,
    setScope,
    loadChannels,
    loadQueue,
    setQueueSearch,
    setQueueScope,
    setQueueStatusFilter,
    setQueuePriorityFilter,
    setQueuePage,
    queueParams,
    refresh,
  };
});
