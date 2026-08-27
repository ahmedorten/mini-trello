import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateTask,
  type AgentTask,
  type AgentTaskScope,
  type AgentTaskStatus,
  type CreateAgentTaskPayload,
  type ListAgentTasksParams,
  type UpdateAgentTaskPayload,
} from '@/api/tasks';
import { listAgents, type PaginationMeta, type UserSummary } from '@/api/users';
import { toErrorMessage } from '@/api/client';

export const useTasksStore = defineStore('tasks', () => {
  const items = ref<AgentTask[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  // The ticket-scoped panel keeps its own list (mirrors the dashboard
  // queue's isolation from useTicketsStore, Product rule 7 one level down):
  // TasksView.vue and the workspace's TicketTasksPanel are both mounted
  // independently, and a mutation from one must not stomp the other's list.
  const ticketTasks = ref<AgentTask[]>([]);
  const agents = ref<UserSummary[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);

  const filters = reactive({
    page: 1,
    pageSize: 20,
    scope: 'mine' as AgentTaskScope,
    status: '' as AgentTaskStatus | '',
    overdueOnly: false,
  });

  function currentParams(): ListAgentTasksParams {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      scope: filters.scope,
      status: filters.status || undefined,
      overdueOnly: filters.overdueOnly || undefined,
    };
  }

  let latestRequestId = 0;

  async function load(): Promise<void> {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    error.value = null;

    try {
      const result = await listTasks(currentParams());

      if (requestId !== latestRequestId) {
        return;
      }

      items.value = result.items;
      meta.value = result.meta;
    } catch (caught) {
      if (requestId !== latestRequestId) {
        return;
      }

      items.value = [];
      meta.value = null;
      error.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestRequestId) {
        isLoading.value = false;
      }
    }
  }

  async function loadForTicket(ticketId: string): Promise<void> {
    try {
      const result = await listTasks({ ticketId, pageSize: 100 });
      ticketTasks.value = result.items;
    } catch {
      // A caller without tasks:read (or one lacking access to this ticket's
      // tasks) simply sees the panel hide — see TicketTasksPanel.vue.
      ticketTasks.value = [];
    }
  }

  async function loadAgents(): Promise<void> {
    try {
      agents.value = await listAgents();
    } catch {
      // A plain support agent lacks users:read; the picker simply stays empty.
      agents.value = [];
    }
  }

  function setScopeFilter(scope: AgentTaskScope): void {
    filters.scope = scope;
    filters.page = 1;
    void load();
  }

  function setStatusFilter(status: AgentTaskStatus | ''): void {
    filters.status = status;
    filters.page = 1;
    void load();
  }

  function setOverdueOnly(overdueOnly: boolean): void {
    filters.overdueOnly = overdueOnly;
    filters.page = 1;
    void load();
  }

  function setPage(page: number): void {
    filters.page = page;
    void load();
  }

  async function create(
    payload: CreateAgentTaskPayload,
    fromTicketPanel = false,
    ticketId?: string,
  ): Promise<boolean> {
    isSaving.value = true;
    error.value = null;

    try {
      await createTask(payload);

      if (fromTicketPanel && ticketId) {
        await loadForTicket(ticketId);
      } else {
        await load();
      }

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function update(
    id: string,
    payload: UpdateAgentTaskPayload,
    fromTicketPanel = false,
    ticketId?: string,
  ): Promise<boolean> {
    isSaving.value = true;
    error.value = null;

    try {
      await updateTask(id, payload);

      if (fromTicketPanel && ticketId) {
        await loadForTicket(ticketId);
      } else {
        await load();
      }

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function setStatus(id: string, status: AgentTaskStatus, fromTicketPanel = false, ticketId?: string): Promise<boolean> {
    try {
      await setTaskStatus(id, status);

      if (fromTicketPanel && ticketId) {
        await loadForTicket(ticketId);
      } else {
        await load();
      }

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function remove(id: string, fromTicketPanel = false, ticketId?: string): Promise<boolean> {
    try {
      await deleteTask(id);

      if (fromTicketPanel && ticketId) {
        await loadForTicket(ticketId);
      } else {
        await load();
      }

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  function clearTicketTasks(): void {
    ticketTasks.value = [];
  }

  return {
    items,
    meta,
    ticketTasks,
    agents,
    isLoading,
    isSaving,
    error,
    filters,
    load,
    loadForTicket,
    loadAgents,
    setScopeFilter,
    setStatusFilter,
    setOverdueOnly,
    setPage,
    create,
    update,
    setStatus,
    remove,
    clearTicketTasks,
  };
});
