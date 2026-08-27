<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import { useDashboardStore } from '@/stores/dashboard';
import { useTasksStore } from '@/stores/tasks';
import { TICKET_SCOPES, type TicketScope } from '@/api/dashboard';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketAttachment,
  type TicketComment,
  type TicketPriority,
  type TicketStatus,
} from '@/api/tickets';
import { formatBytes } from '@/utils/format';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppTabs from '@/components/AppTabs.vue';
import AppPagination from '@/components/AppPagination.vue';
import CommunicationTimeline from '@/components/CommunicationTimeline.vue';
import ReassignControl from '@/components/ReassignControl.vue';
import QuickReplyPicker from '@/components/QuickReplyPicker.vue';
import CustomerSummaryCard from '@/components/CustomerSummaryCard.vue';
import TicketTasksPanel from '@/components/TicketTasksPanel.vue';
import type { AppTab } from '@/components/tabs';

const route = useRoute();
const auth = useAuthStore();
const tickets = useTicketsStore();
const dashboard = useDashboardStore();
const tasks = useTasksStore();
const { t, d, n } = useI18n();

const ticketId = computed(() => (route.params.id as string | undefined) ?? null);

// --- mobile region switcher --------------------------------------------------

const activeMobileTab = ref<'queue' | 'ticket' | 'context'>('queue');

const mobileTabs = computed<AppTab[]>(() => [
  { key: 'queue', labelKey: 'workspace.tab.queue' },
  { key: 'ticket', labelKey: 'workspace.tab.ticket' },
  { key: 'context', labelKey: 'workspace.tab.context' },
]);

// --- queue -------------------------------------------------------------------

const searchTerm = ref(dashboard.queueFilters.search);
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

watch(searchTerm, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  searchDebounce = setTimeout(() => {
    dashboard.setQueueSearch(value);
  }, 300);
});

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
});

function onQueueScopeChange(event: Event): void {
  dashboard.setQueueScope((event.target as HTMLSelectElement).value as TicketScope);
}

function onQueueStatusChange(event: Event): void {
  dashboard.setQueueStatusFilter((event.target as HTMLSelectElement).value as TicketStatus | '');
}

function onQueuePriorityChange(event: Event): void {
  dashboard.setQueuePriorityFilter((event.target as HTMLSelectElement).value as TicketPriority | '');
}

function onQueuePageChange(page: number): void {
  dashboard.setQueuePage(page);
}

function selectTicket(): void {
  activeMobileTab.value = 'ticket';
}

// --- centre: status/tabs ------------------------------------------------------

async function changeStatus(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value as TicketStatus;

  if (tickets.current) {
    await tickets.setStatus(tickets.current.id, value);
  }
}

const activeTab = ref<'comments' | 'communication' | 'attachments' | 'history'>('comments');

const tabs = computed<AppTab[]>(() => [
  { key: 'comments', labelKey: 'workspace.tab.notes', count: tickets.comments.length },
  { key: 'communication', labelKey: 'workspace.tab.communication' },
  { key: 'attachments', labelKey: 'workspace.tab.files', count: tickets.attachments.length },
  { key: 'history', labelKey: 'workspace.tab.history' },
]);

// --- comments ------------------------------------------------------------

const newCommentBody = ref('');
const editingCommentId = ref<string | null>(null);
const editingCommentBody = ref('');

function isOwnComment(comment: TicketComment): boolean {
  return comment.author.id === auth.user?.id;
}

async function submitNewComment(): Promise<void> {
  if (!newCommentBody.value.trim() || !ticketId.value) {
    return;
  }

  const ok = await tickets.addComment(ticketId.value, { body: newCommentBody.value });

  if (ok) {
    newCommentBody.value = '';
  }
}

function startEditComment(comment: TicketComment): void {
  editingCommentId.value = comment.id;
  editingCommentBody.value = comment.body;
}

function cancelEditComment(): void {
  editingCommentId.value = null;
}

async function submitEditComment(comment: TicketComment): Promise<void> {
  if (!ticketId.value) {
    return;
  }

  const ok = await tickets.editComment(ticketId.value, comment.id, { body: editingCommentBody.value });

  if (ok) {
    editingCommentId.value = null;
  }
}

async function removeComment(comment: TicketComment): Promise<void> {
  if (ticketId.value && window.confirm(t('ticket.detail.deleteCommentConfirm'))) {
    await tickets.removeComment(ticketId.value, comment.id);
  }
}

// --- attachments -------------------------------------------------------------

const pendingFile = ref<File | null>(null);

function onFileChange(event: Event): void {
  const files = (event.target as HTMLInputElement).files;
  pendingFile.value = files && files.length > 0 ? files[0] : null;
}

async function submitUpload(): Promise<void> {
  if (!pendingFile.value || !ticketId.value) {
    return;
  }

  const ok = await tickets.uploadFile(ticketId.value, pendingFile.value);

  if (ok) {
    pendingFile.value = null;
  }
}

async function download(attachment: TicketAttachment): Promise<void> {
  if (ticketId.value) {
    await tickets.downloadFile(ticketId.value, attachment);
  }
}

function isOwnAttachment(attachment: TicketAttachment): boolean {
  return attachment.uploadedBy.id === auth.user?.id;
}

async function removeAttachment(attachment: TicketAttachment): Promise<void> {
  if (ticketId.value && window.confirm(t('ticket.detail.deleteAttachmentConfirm', { fileName: attachment.fileName }))) {
    await tickets.removeAttachment(ticketId.value, attachment.id);
  }
}

function attachmentSize(bytes: number): string {
  const { value, unitKey } = formatBytes(bytes);

  return `${n(value, 'decimal')} ${t(`common.bytes.${unitKey}`)}`;
}

// --- history -------------------------------------------------------------

function historyFieldLabel(field: string): string {
  const key = `ticket.history.field.${field}`;
  const translated = t(key);

  return translated === key ? field : translated;
}

function resolveHistoryValue(field: string, value: string | null): string {
  if (field === 'assignedAgentId') {
    if (!value) {
      return t('common.unassigned');
    }

    const agent = tasks.agents.find((candidate) => candidate.id === value);

    return agent?.fullName ?? value;
  }

  return value ?? '—';
}

// --- lifecycle -------------------------------------------------------------

watch(
  () => route.params.id,
  (id) => {
    if (typeof id === 'string') {
      void tickets.loadDetail(id);
    } else {
      tickets.clearDetail();
      tasks.clearTicketTasks();
    }
  },
);

onMounted(() => {
  void dashboard.loadQueue();
  void dashboard.loadChannels();

  if (ticketId.value) {
    void tickets.loadDetail(ticketId.value);
  }
});

onUnmounted(() => {
  tickets.clearDetail();
  tasks.clearTicketTasks();
});
</script>

<template>
  <div class="workspace">
    <AppTabs v-model="activeMobileTab" class="workspace__mobile-tabs" :tabs="mobileTabs" />

    <aside class="workspace__queue" :class="{ 'workspace__region--hidden-mobile': activeMobileTab !== 'queue' }">
      <details class="workspace__queue-disclosure" open>
        <summary class="workspace__queue-toggle">{{ t('workspace.queue') }}</summary>

        <div class="workspace__queue-body">
          <input
            v-model="searchTerm"
            type="search"
            class="workspace__queue-search"
            :placeholder="t('ticket.list.searchPlaceholder')"
          >

          <label>
            {{ t('dashboard.scopeLabel') }}
            <select :value="dashboard.queueFilters.scope" @change="onQueueScopeChange">
              <option v-for="scope in TICKET_SCOPES" :key="scope" :value="scope">
                {{ t(`dashboard.scope.${scope}`) }}
              </option>
            </select>
          </label>

          <label>
            {{ t('ticket.field.status') }}
            <select :value="dashboard.queueFilters.status" @change="onQueueStatusChange">
              <option value="">{{ t('ticket.list.allStatuses') }}</option>
              <option v-for="status in TICKET_STATUSES" :key="status" :value="status">
                {{ t(`ticket.status.${status}`) }}
              </option>
            </select>
          </label>

          <label>
            {{ t('ticket.field.priority') }}
            <select :value="dashboard.queueFilters.priority" @change="onQueuePriorityChange">
              <option value="">{{ t('ticket.list.allPriorities') }}</option>
              <option v-for="priority in TICKET_PRIORITIES" :key="priority" :value="priority">
                {{ t(`ticket.priority.${priority}`) }}
              </option>
            </select>
          </label>

          <AppStateBlock v-if="dashboard.isQueueLoading && !dashboard.queueItems.length" variant="loading" :message="t('common.loading')" />
          <AppStateBlock v-else-if="dashboard.queueError && !dashboard.queueItems.length" variant="error" :message="dashboard.queueError" />
          <AppStateBlock v-else-if="!dashboard.queueItems.length" variant="empty" :message="t('ticket.list.empty')" />

          <ul v-else class="workspace__queue-list">
            <li v-for="ticket in dashboard.queueItems" :key="ticket.id">
              <RouterLink
                :to="`/workspace/${ticket.id}`"
                class="workspace__queue-row"
                :aria-current="ticket.id === ticketId ? 'true' : undefined"
                :class="{ 'workspace__queue-row--active': ticket.id === ticketId }"
                @click="selectTicket"
              >
                <span class="workspace__queue-subject">{{ ticket.subject }}</span>
                <span class="workspace__queue-customer">{{ ticket.customer.name }}</span>
                <AppBadge :status="ticket.status" />
                <AppBadge :priority="ticket.priority" />
              </RouterLink>
            </li>
          </ul>

          <AppPagination
            v-if="dashboard.queueMeta"
            :page="dashboard.queueMeta.page"
            :total-pages="dashboard.queueMeta.totalPages"
            :total="dashboard.queueMeta.total"
            @change="onQueuePageChange"
          />
        </div>
      </details>
    </aside>

    <section class="workspace__centre" :class="{ 'workspace__region--hidden-mobile': activeMobileTab !== 'ticket' }">
      <AppStateBlock v-if="!ticketId" variant="empty" :message="t('workspace.selectPrompt')" />

      <AppStateBlock v-else-if="tickets.error && !tickets.current" variant="error" :message="tickets.error" />

      <template v-else-if="tickets.current">
        <header class="workspace__ticket-header">
          <div>
            <h1>{{ tickets.current.subject }}</h1>
            <RouterLink :to="`/customers/${tickets.current.customer.id}`" class="workspace__ticket-customer">
              {{ tickets.current.customer.name }}
            </RouterLink>
          </div>

          <div class="workspace__ticket-controls">
            <AppBadge :status="tickets.current.status" />
            <AppBadge :priority="tickets.current.priority" />

            <select v-if="auth.can('tickets:write')" :value="tickets.current.status" @change="changeStatus">
              <option v-for="status in TICKET_STATUSES" :key="status" :value="status">
                {{ t(`ticket.status.${status}`) }}
              </option>
            </select>

            <ReassignControl :ticket="tickets.current" />

            <RouterLink :to="`/tickets/${tickets.current.id}/edit`">{{ t('common.edit') }}</RouterLink>
          </div>
        </header>

        <p class="workspace__ticket-description">{{ tickets.current.description }}</p>

        <AppTabs v-model="activeTab" :tabs="tabs" class="workspace__tabs" />

        <div v-if="activeTab === 'comments'" class="workspace__panel">
          <form v-if="auth.can('ticket-comments:write')" class="workspace__comment-form" @submit.prevent="submitNewComment">
            <label>
              {{ t('ticket.detail.addComment') }}
              <textarea v-model="newCommentBody" rows="3" required />
            </label>
            <QuickReplyPicker v-model="newCommentBody" mode="insert" />
            <button type="submit">{{ t('common.save') }}</button>
          </form>

          <p v-if="!tickets.comments.length">{{ t('ticket.detail.noComments') }}</p>

          <ul v-else class="workspace__comment-list">
            <li v-for="comment in tickets.comments" :key="comment.id" class="workspace__comment">
              <template v-if="editingCommentId === comment.id">
                <textarea v-model="editingCommentBody" rows="3" />
                <div class="workspace__comment-actions">
                  <button type="button" @click="submitEditComment(comment)">{{ t('common.save') }}</button>
                  <button type="button" @click="cancelEditComment">{{ t('common.cancel') }}</button>
                </div>
              </template>
              <template v-else>
                <p class="workspace__comment-meta">
                  {{ comment.author.fullName }} — {{ d(new Date(comment.createdAt), 'long') }}
                </p>
                <p class="workspace__comment-body">{{ comment.body }}</p>
                <div v-if="isOwnComment(comment) || auth.can('tickets:manage')" class="workspace__comment-actions">
                  <button v-if="isOwnComment(comment)" type="button" @click="startEditComment(comment)">
                    {{ t('common.edit') }}
                  </button>
                  <button type="button" @click="removeComment(comment)">{{ t('common.delete') }}</button>
                </div>
              </template>
            </li>
          </ul>
        </div>

        <div v-else-if="activeTab === 'communication'" class="workspace__panel">
          <CommunicationTimeline :ticket-id="tickets.current.id" :customer-id="tickets.current.customer.id" />
        </div>

        <div v-else-if="activeTab === 'attachments'" class="workspace__panel">
          <div v-if="auth.can('ticket-attachments:write')" class="workspace__upload">
            <input type="file" @change="onFileChange">
            <button type="button" :disabled="!pendingFile" @click="submitUpload">{{ t('attachment.upload') }}</button>
          </div>

          <p v-if="!tickets.attachments.length">{{ t('ticket.detail.noAttachments') }}</p>

          <ul v-else class="workspace__attachment-list">
            <li v-for="attachment in tickets.attachments" :key="attachment.id" class="workspace__attachment">
              <span dir="ltr">{{ attachment.fileName }}</span>
              <span>{{ attachmentSize(attachment.sizeBytes) }}</span>
              <span>{{ attachment.uploadedBy.fullName }}</span>
              <span>{{ d(new Date(attachment.createdAt), 'long') }}</span>
              <div class="workspace__attachment-actions">
                <button type="button" @click="download(attachment)">{{ t('attachment.download') }}</button>
                <button
                  v-if="isOwnAttachment(attachment) || auth.can('tickets:manage')"
                  type="button"
                  @click="removeAttachment(attachment)"
                >
                  {{ t('common.delete') }}
                </button>
              </div>
            </li>
          </ul>
        </div>

        <div v-else class="workspace__panel">
          <p v-if="!tickets.history.length">{{ t('ticket.detail.noHistory') }}</p>

          <ul v-else class="workspace__history-list">
            <li v-for="entry in tickets.history" :key="entry.id" class="workspace__history-entry">
              <p class="workspace__history-field">{{ historyFieldLabel(entry.field) }}</p>
              <p class="workspace__history-change">
                {{ resolveHistoryValue(entry.field, entry.oldValue) }}
                →
                {{ resolveHistoryValue(entry.field, entry.newValue) }}
              </p>
              <p class="workspace__history-meta">
                {{ t('ticket.detail.changedBy', { name: entry.changedBy.fullName, date: d(new Date(entry.createdAt), 'long') }) }}
              </p>
            </li>
          </ul>
        </div>
      </template>
    </section>

    <aside class="workspace__rail" :class="{ 'workspace__region--hidden-mobile': activeMobileTab !== 'context' }">
      <template v-if="tickets.current">
        <CustomerSummaryCard :customer-id="tickets.current.customer.id" :ticket-id="tickets.current.id" />
        <TicketTasksPanel :ticket-id="tickets.current.id" :customer-id="tickets.current.customer.id" />
        <QuickReplyPicker :model-value="''" mode="browse" />
      </template>
    </aside>
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: 20rem minmax(0, 1fr) 22rem;
  align-items: start;
}

.workspace__mobile-tabs {
  display: none;
  grid-column: 1 / -1;
}

.workspace__queue-disclosure > summary {
  cursor: pointer;
  font-weight: var(--font-weight-medium);
}

.workspace__queue-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-block-start: var(--space-3);
}

.workspace__queue-search {
  inline-size: 100%;
}

.workspace__queue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.workspace__queue-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
}

.workspace__queue-row--active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.workspace__queue-subject {
  font-weight: var(--font-weight-medium);
}

.workspace__queue-customer {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.workspace__centre,
.workspace__rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.workspace__ticket-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.workspace__ticket-customer {
  color: var(--color-text-muted);
}

.workspace__ticket-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.workspace__ticket-description {
  white-space: pre-wrap;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.workspace__panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-5);
}

.workspace__comment-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-block-end: var(--space-5);
}

.workspace__comment-list,
.workspace__attachment-list,
.workspace__history-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.workspace__comment,
.workspace__history-entry {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.workspace__comment-meta,
.workspace__history-meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.workspace__comment-actions,
.workspace__attachment-actions {
  display: flex;
  gap: var(--space-2);
  margin-block-start: var(--space-2);
}

.workspace__attachment {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.workspace__upload {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-block-end: var(--space-5);
}

@media (max-width: 1199px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) and (max-width: 1199px) {
  .workspace__queue-disclosure > summary {
    display: block;
  }
}

@media (min-width: 1200px) {
  .workspace__queue-disclosure > summary {
    display: none;
  }
}

@media (max-width: 767px) {
  .workspace__mobile-tabs {
    display: flex;
  }

  .workspace__queue-disclosure > summary {
    display: none;
  }

  .workspace__region--hidden-mobile {
    display: none;
  }
}
</style>
