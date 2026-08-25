import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import {
  createCustomer,
  createInteraction,
  createNote,
  deleteAttachment,
  deleteInteraction,
  deleteNote,
  downloadAttachment as downloadAttachmentRequest,
  getCustomer,
  listAttachments,
  listCustomers,
  listInteractions,
  listNotes,
  setCustomerStatus,
  updateCustomer,
  updateNote,
  uploadAttachment as uploadAttachmentRequest,
  type Customer,
  type CustomerAttachment,
  type CustomerInteraction,
  type CustomerNote,
  type CustomerStatus,
  type CustomerType,
  type CreateCustomerPayload,
  type CreateInteractionPayload,
  type ListCustomersParams,
  type NotePayload,
  type UpdateCustomerPayload,
} from '@/api/customers';
import { listAgents, type PaginationMeta, type UserSummary } from '@/api/users';
import { toErrorMessage } from '@/api/client';

export const useCustomersStore = defineStore('customers', () => {
  const items = ref<Customer[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const current = ref<Customer | null>(null);
  const notes = ref<CustomerNote[]>([]);
  const attachments = ref<CustomerAttachment[]>([]);
  const interactions = ref<CustomerInteraction[]>([]);
  const agents = ref<UserSummary[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);

  const filters = reactive({
    page: 1,
    pageSize: 20,
    search: '',
    status: '' as CustomerStatus | '',
    type: '' as CustomerType | '',
    city: '',
  });

  function currentParams(): ListCustomersParams {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined,
      city: filters.city || undefined,
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
      const result = await listCustomers(currentParams());

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

  // Separate from `latestRequestId`: switching customers fast enough must not
  // let customer A's response land after customer B's.
  let latestDetailRequestId = 0;

  async function loadDetail(id: string): Promise<void> {
    const requestId = ++latestDetailRequestId;
    isLoading.value = true;
    error.value = null;

    try {
      const [customer, noteList, attachmentList, interactionList] = await Promise.all([
        getCustomer(id),
        listNotes(id),
        listAttachments(id),
        listInteractions(id),
      ]);

      if (requestId !== latestDetailRequestId) {
        return;
      }

      current.value = customer;
      notes.value = noteList;
      attachments.value = attachmentList;
      interactions.value = interactionList;
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

  function setSearch(term: string): void {
    filters.search = term;
    filters.page = 1;
    void load();
  }

  function setStatusFilter(status: CustomerStatus | ''): void {
    filters.status = status;
    filters.page = 1;
    void load();
  }

  function setTypeFilter(type: CustomerType | ''): void {
    filters.type = type;
    filters.page = 1;
    void load();
  }

  function setPage(page: number): void {
    filters.page = page;
    void load();
  }

  async function create(payload: CreateCustomerPayload): Promise<string | null> {
    isSaving.value = true;
    error.value = null;

    try {
      const created = await createCustomer(payload);

      return created.id;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return null;
    } finally {
      isSaving.value = false;
    }
  }

  async function update(id: string, payload: UpdateCustomerPayload): Promise<boolean> {
    isSaving.value = true;
    error.value = null;

    try {
      await updateCustomer(id, payload);
      await loadDetail(id);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function setStatus(id: string, status: CustomerStatus): Promise<boolean> {
    try {
      await setCustomerStatus(id, status);
      await loadDetail(id);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function addNote(customerId: string, payload: NotePayload): Promise<boolean> {
    try {
      await createNote(customerId, payload);
      notes.value = await listNotes(customerId);
      current.value = await getCustomer(customerId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function editNote(customerId: string, id: string, payload: NotePayload): Promise<boolean> {
    try {
      await updateNote(customerId, id, payload);
      notes.value = await listNotes(customerId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function removeNote(customerId: string, id: string): Promise<boolean> {
    try {
      await deleteNote(customerId, id);
      notes.value = await listNotes(customerId);
      current.value = await getCustomer(customerId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function uploadFile(customerId: string, file: File): Promise<boolean> {
    try {
      await uploadAttachmentRequest(customerId, file);
      attachments.value = await listAttachments(customerId);
      current.value = await getCustomer(customerId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function downloadFile(customerId: string, attachment: CustomerAttachment): Promise<boolean> {
    try {
      await downloadAttachmentRequest(customerId, attachment);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function removeAttachment(customerId: string, id: string): Promise<boolean> {
    try {
      await deleteAttachment(customerId, id);
      attachments.value = await listAttachments(customerId);
      current.value = await getCustomer(customerId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function addInteraction(customerId: string, payload: CreateInteractionPayload): Promise<boolean> {
    try {
      await createInteraction(customerId, payload);
      interactions.value = await listInteractions(customerId);
      current.value = await getCustomer(customerId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  async function removeInteraction(customerId: string, id: string): Promise<boolean> {
    try {
      await deleteInteraction(customerId, id);
      interactions.value = await listInteractions(customerId);
      current.value = await getCustomer(customerId);

      return true;
    } catch (caught) {
      error.value = toErrorMessage(caught);

      return false;
    }
  }

  function clearDetail(): void {
    current.value = null;
    notes.value = [];
    attachments.value = [];
    interactions.value = [];
    error.value = null;
  }

  return {
    items,
    meta,
    current,
    notes,
    attachments,
    interactions,
    agents,
    isLoading,
    isSaving,
    error,
    filters,
    load,
    loadDetail,
    loadAgents,
    setSearch,
    setStatusFilter,
    setTypeFilter,
    setPage,
    create,
    update,
    setStatus,
    addNote,
    editNote,
    removeNote,
    uploadFile,
    downloadFile,
    removeAttachment,
    addInteraction,
    removeInteraction,
    clearDetail,
  };
});
