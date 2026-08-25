import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import {
  createComment,
  createTicket,
  deleteComment,
  deleteTicketAttachment,
  downloadTicketAttachment as downloadTicketAttachmentRequest,
  getTicket,
  listComments,
  listTicketAttachments,
  listTicketHistory,
  listTickets,
  setTicketStatus,
  updateComment,
  updateTicket,
  uploadTicketAttachment as uploadTicketAttachmentRequest,
  type CommentPayload,
  type CreateTicketPayload,
  type ListTicketsParams,
  type Ticket,
  type TicketAttachment,
  type TicketCategory,
  type TicketComment,
  type TicketHistoryEntry,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketPayload,
} from '@/api/tickets';
import { listCustomerRefs, type CustomerRefOption } from '@/api/customers';
import { listAgents, type PaginationMeta, type UserSummary } from '@/api/users';
import { toErrorMessage } from '@/api/client';

export const useTicketsStore = defineStore('tickets', () => {
  const items = ref<Ticket[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const current = ref<Ticket | null>(null);
  const comments = ref<TicketComment[]>([]);
  const attachments = ref<TicketAttachment[]>([]);
  const history = ref<TicketHistoryEntry[]>([]);
  const agents = ref<UserSummary[]>([]);
  const customerOptions = ref<CustomerRefOption[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);

  const filters = reactive({
    page: 1,
    pageSize: 20,
    search: '',
    category: '' as TicketCategory | '',
    priority: '' as TicketPriority | '',
    status: '' as TicketStatus | '',
    assignedAgentId: '',
  });

  function currentParams(): ListTicketsParams {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      category: filters.category || undefined,
      priority: filters.priority || undefined,
      status: filters.status || undefined,
      assignedAgentId: filters.assignedAgentId || undefined,
    };
  }

  // Guards against a slow response for an earlier search/filter overwriting a
  // faster response for a later one.
  let latestRequestId = 0;

  async function load(): Promise<void> {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    error.value = null;

    try {
      const result = await listTickets(currentParams());

      if (requestId !== latestRequestId) {
        return;
      }

      items.value = result.items;
      meta.value = result.meta;
    } catch (caught) {
      if (requestId !== latestRequestId) {
        return;
      }

      // A stale list must never sit next to an error message.
      items.value = [];
      meta.value = null;
      error.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestRequestId) {
        isLoading.value = false;
      }
    }
  }

  // Separate from `latestRequestId`: switching tickets fast enough must not
  // let ticket A's response land after ticket B's.
  let latestDetailRequestId = 0;

  async function loadDetail(id: string): Promise<void> {
    const requestId = ++latestDetailRequestId;
    isLoading.value = true;
    error.value = null;

    try {
      const [ticket, commentList, attachmentList, historyList] = await Promise.all([
        getTicket(id),
        listComments(id),
        listTicketAttachments(id),
        listTicketHistory(id),
      ]);

      if (requestId !== latestDetailRequestId) {
        return;
      }

      current.value = ticket;
      comments.value = commentList;
      attachments.value = attachmentList;
      history.value = historyList;
    } catch (caught) {
      if (requestId !== latestDetailRequestId) {
        return;
      }

      current.value = null;
      error.value = toErrorMessage(caught);
    } finally {
      if (requestId === latestDetailRequestId) {
        isLoading.value = false;
      }
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

  async function loadCustomerOptions(): Promise<void> {
    try {
      customerOptions.value = await listCustomerRefs();
    } catch {
      // A caller without customers:read still needs to create tickets against
      // customers they can already see via tickets:read's embedded customer
      // ref — a failure here must not block ticket creation.
      customerOptions.value = [];
    }
  }

  function setSearch(term: string): void {
    filters.search = term;
    filters.page = 1;
    void load();
  }

  function setCategoryFilter(category: TicketCategory | ''): void {
    filters.category = category;
    filters.page = 1;
    void load();
  }

  function setPriorityFilter(priority: TicketPriority | ''): void {
    filters.priority = priority;
    filters.page = 1;
    void load();
  }

  function setStatusFilter(status: TicketStatus | ''): void {
    filters.status = status;
    filters.page = 1;
    void load();
  }

  function setAssignedAgentFilter(assignedAgentId: string): void {
    filters.assignedAgentId = assignedAgentId;
    filters.page = 1;
    void load();
  }

  function setPage(page: number): void {
    filters.page = page;
    void load();
  }

  async function create(payload: CreateTicketPayload): Promise<string | null> {
    isSaving.value = true;
    error.value = null;

    try {
      const created = await createTicket(payload);

      return created.id;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return null;
    } finally {
      isSaving.value = false;
    }
  }

  async function update(id: string, payload: UpdateTicketPayload): Promise<boolean> {
    isSaving.value = true;
    error.value = null;

    try {
      await updateTicket(id, payload);
      await loadDetail(id);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function setStatus(id: string, status: TicketStatus): Promise<boolean> {
    try {
      await setTicketStatus(id, status);
      await loadDetail(id);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function addComment(ticketId: string, payload: CommentPayload): Promise<boolean> {
    try {
      await createComment(ticketId, payload);
      comments.value = await listComments(ticketId);
      current.value = await getTicket(ticketId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function editComment(ticketId: string, id: string, payload: CommentPayload): Promise<boolean> {
    try {
      await updateComment(ticketId, id, payload);
      comments.value = await listComments(ticketId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function removeComment(ticketId: string, id: string): Promise<boolean> {
    try {
      await deleteComment(ticketId, id);
      comments.value = await listComments(ticketId);
      current.value = await getTicket(ticketId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function uploadFile(ticketId: string, file: File): Promise<boolean> {
    try {
      await uploadTicketAttachmentRequest(ticketId, file);
      attachments.value = await listTicketAttachments(ticketId);
      current.value = await getTicket(ticketId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function downloadFile(ticketId: string, attachment: TicketAttachment): Promise<boolean> {
    try {
      await downloadTicketAttachmentRequest(ticketId, attachment);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function removeAttachment(ticketId: string, id: string): Promise<boolean> {
    try {
      await deleteTicketAttachment(ticketId, id);
      attachments.value = await listTicketAttachments(ticketId);
      current.value = await getTicket(ticketId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  function clearDetail(): void {
    current.value = null;
    comments.value = [];
    attachments.value = [];
    history.value = [];
    error.value = null;
  }

  return {
    items,
    meta,
    current,
    comments,
    attachments,
    history,
    agents,
    customerOptions,
    isLoading,
    isSaving,
    error,
    filters,
    load,
    loadDetail,
    loadAgents,
    loadCustomerOptions,
    setSearch,
    setCategoryFilter,
    setPriorityFilter,
    setStatusFilter,
    setAssignedAgentFilter,
    setPage,
    create,
    update,
    setStatus,
    addComment,
    editComment,
    removeComment,
    uploadFile,
    downloadFile,
    removeAttachment,
    clearDetail,
  };
});
