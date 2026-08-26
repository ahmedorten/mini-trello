<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import {
  TICKET_STATUSES,
  type TicketAttachment,
  type TicketComment,
  type TicketStatus,
} from '@/api/tickets';
import { formatBytes } from '@/utils/format';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppTabs from '@/components/AppTabs.vue';
import type { AppTab } from '@/components/tabs';

const route = useRoute();
const auth = useAuthStore();
const tickets = useTicketsStore();
const { t, d, n } = useI18n();

const ticketId = computed(() => route.params.id as string);

async function changeStatus(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value as TicketStatus;

  if (tickets.current) {
    await tickets.setStatus(tickets.current.id, value);
  }
}

// --- tabs ------------------------------------------------------------------

const activeTab = ref<'comments' | 'attachments' | 'history'>('comments');

const tabs = computed<AppTab[]>(() => [
  { key: 'comments', labelKey: 'ticket.tab.comments', count: tickets.comments.length },
  { key: 'attachments', labelKey: 'ticket.tab.attachments', count: tickets.attachments.length },
  { key: 'history', labelKey: 'ticket.tab.history' },
]);

// --- comments ----------------------------------------------------------------

const newCommentBody = ref('');
const editingCommentId = ref<string | null>(null);
const editingCommentBody = ref('');

function isOwnComment(comment: TicketComment): boolean {
  return comment.author.id === auth.user?.id;
}

async function submitNewComment(): Promise<void> {
  if (!newCommentBody.value.trim()) {
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
  const ok = await tickets.editComment(ticketId.value, comment.id, { body: editingCommentBody.value });

  if (ok) {
    editingCommentId.value = null;
  }
}

async function removeComment(comment: TicketComment): Promise<void> {
  if (window.confirm(t('ticket.detail.deleteCommentConfirm'))) {
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
  if (!pendingFile.value) {
    return;
  }

  const ok = await tickets.uploadFile(ticketId.value, pendingFile.value);

  if (ok) {
    pendingFile.value = null;
  }
}

async function download(attachment: TicketAttachment): Promise<void> {
  await tickets.downloadFile(ticketId.value, attachment);
}

function isOwnAttachment(attachment: TicketAttachment): boolean {
  return attachment.uploadedBy.id === auth.user?.id;
}

async function removeAttachment(attachment: TicketAttachment): Promise<void> {
  if (window.confirm(t('ticket.detail.deleteAttachmentConfirm', { fileName: attachment.fileName }))) {
    await tickets.removeAttachment(ticketId.value, attachment.id);
  }
}

function attachmentSize(bytes: number): string {
  const { value, unitKey } = formatBytes(bytes);

  return `${n(value, 'decimal')} ${t(`common.bytes.${unitKey}`)}`;
}

// --- history -----------------------------------------------------------------

function historyFieldLabel(field: string): string {
  const key = `ticket.history.field.${field}`;
  const translated = t(key);

  return translated === key ? field : translated;
}

/** Best-effort only: TicketHistory never snapshots display names. A resolved
 *  name is shown when the UUID happens to match a currently-loaded agent;
 *  otherwise the raw UUID is shown, per the documented limitation. */
function resolveHistoryValue(field: string, value: string | null): string {
  if (field === 'assignedAgentId') {
    if (!value) {
      return t('common.unassigned');
    }

    const agent = tickets.agents.find((candidate) => candidate.id === value);

    return agent?.fullName ?? value;
  }

  return value ?? '—';
}

onMounted(() => {
  void tickets.loadDetail(ticketId.value);
  void tickets.loadAgents();
});

onUnmounted(() => {
  tickets.clearDetail();
});
</script>

<template>
  <section>
    <AppStateBlock v-if="tickets.error && !tickets.current" variant="error" :message="tickets.error" />

    <template v-else-if="tickets.current">
      <header class="ticket-detail__header">
        <div>
          <h1>{{ tickets.current.subject }}</h1>
          <p class="ticket-detail__customer">
            <RouterLink :to="`/customers/${tickets.current.customer.id}`">
              {{ tickets.current.customer.name }}
            </RouterLink>
          </p>
        </div>

        <div class="ticket-detail__controls">
          <AppBadge :status="tickets.current.status" />

          <select v-if="auth.can('tickets:write')" :value="tickets.current.status" @change="changeStatus">
            <option v-for="status in TICKET_STATUSES" :key="status" :value="status">
              {{ t(`ticket.status.${status}`) }}
            </option>
          </select>

          <RouterLink v-if="auth.can('tickets:write')" :to="`/tickets/${tickets.current.id}/edit`">
            {{ t('common.edit') }}
          </RouterLink>
        </div>
      </header>

      <p class="ticket-detail__description">{{ tickets.current.description }}</p>

      <dl class="ticket-detail__overview">
        <div>
          <dt>{{ t('ticket.field.category') }}</dt>
          <dd>{{ t(`ticket.category.${tickets.current.category}`) }}</dd>
        </div>
        <div>
          <dt>{{ t('ticket.field.priority') }}</dt>
          <dd><AppBadge :priority="tickets.current.priority" /></dd>
        </div>
        <div>
          <dt>{{ t('ticket.field.assignedAgent') }}</dt>
          <dd>{{ tickets.current.assignedAgent?.fullName ?? t('common.unassigned') }}</dd>
        </div>
        <div>
          <dt>{{ t('ticket.field.createdBy') }}</dt>
          <dd>{{ tickets.current.createdBy?.fullName ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('ticket.field.createdAt') }}</dt>
          <dd>{{ d(new Date(tickets.current.createdAt), 'long') }}</dd>
        </div>
        <div>
          <dt>{{ t('ticket.field.updatedAt') }}</dt>
          <dd>{{ d(new Date(tickets.current.updatedAt), 'long') }}</dd>
        </div>
      </dl>

      <AppTabs v-model="activeTab" :tabs="tabs" class="ticket-detail__tabs" />

      <div v-if="activeTab === 'comments'" class="ticket-detail__panel">
        <form
          v-if="auth.can('ticket-comments:write')"
          class="ticket-detail__comment-form"
          @submit.prevent="submitNewComment"
        >
          <label>
            {{ t('ticket.detail.addComment') }}
            <textarea v-model="newCommentBody" rows="3" required />
          </label>
          <button type="submit">{{ t('common.save') }}</button>
        </form>

        <p v-if="!tickets.comments.length">{{ t('ticket.detail.noComments') }}</p>

        <ul v-else class="ticket-detail__comment-list">
          <li v-for="comment in tickets.comments" :key="comment.id" class="ticket-detail__comment">
            <template v-if="editingCommentId === comment.id">
              <textarea v-model="editingCommentBody" rows="3" />
              <div class="ticket-detail__comment-actions">
                <button type="button" @click="submitEditComment(comment)">{{ t('common.save') }}</button>
                <button type="button" @click="cancelEditComment">{{ t('common.cancel') }}</button>
              </div>
            </template>
            <template v-else>
              <p class="ticket-detail__comment-meta">
                {{ comment.author.fullName }} — {{ d(new Date(comment.createdAt), 'long') }}
              </p>
              <p class="ticket-detail__comment-body">{{ comment.body }}</p>
              <div
                v-if="isOwnComment(comment) || auth.can('tickets:manage')"
                class="ticket-detail__comment-actions"
              >
                <button v-if="isOwnComment(comment)" type="button" @click="startEditComment(comment)">
                  {{ t('common.edit') }}
                </button>
                <button type="button" @click="removeComment(comment)">{{ t('common.delete') }}</button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <div v-else-if="activeTab === 'attachments'" class="ticket-detail__panel">
        <div v-if="auth.can('ticket-attachments:write')" class="ticket-detail__upload">
          <input type="file" @change="onFileChange">
          <button type="button" :disabled="!pendingFile" @click="submitUpload">{{ t('attachment.upload') }}</button>
          <p class="ticket-detail__hint">{{ t('attachment.hint') }}</p>
        </div>

        <p v-if="!tickets.attachments.length">{{ t('ticket.detail.noAttachments') }}</p>

        <ul v-else class="ticket-detail__attachment-list">
          <li v-for="attachment in tickets.attachments" :key="attachment.id" class="ticket-detail__attachment">
            <span class="ticket-detail__attachment-name" dir="ltr">{{ attachment.fileName }}</span>
            <span>{{ attachmentSize(attachment.sizeBytes) }}</span>
            <span>{{ attachment.uploadedBy.fullName }}</span>
            <span>{{ d(new Date(attachment.createdAt), 'long') }}</span>
            <div class="ticket-detail__attachment-actions">
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

      <div v-else class="ticket-detail__panel">
        <p v-if="!tickets.history.length">{{ t('ticket.detail.noHistory') }}</p>

        <ul v-else class="ticket-detail__history-list">
          <li v-for="entry in tickets.history" :key="entry.id" class="ticket-detail__history-entry">
            <p class="ticket-detail__history-field">{{ historyFieldLabel(entry.field) }}</p>
            <p class="ticket-detail__history-change">
              {{ resolveHistoryValue(entry.field, entry.oldValue) }}
              →
              {{ resolveHistoryValue(entry.field, entry.newValue) }}
            </p>
            <p class="ticket-detail__history-meta">
              {{ t('ticket.detail.changedBy', { name: entry.changedBy.fullName, date: d(new Date(entry.createdAt), 'long') }) }}
            </p>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
.ticket-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-block-end: var(--space-4);
}

.ticket-detail__customer {
  color: var(--color-text-muted);
}

.ticket-detail__controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.ticket-detail__description {
  white-space: pre-wrap;
  margin: 0 0 var(--space-5);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-detail__overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  margin: 0 0 var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-detail__overview dt {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.ticket-detail__overview dd {
  margin: 0;
}

.ticket-detail__tabs {
  margin-block-end: var(--space-4);
}

.ticket-detail__panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-5);
}

.ticket-detail__comment-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-block-end: var(--space-5);
}

.ticket-detail__comment-list,
.ticket-detail__attachment-list,
.ticket-detail__history-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.ticket-detail__comment,
.ticket-detail__history-entry {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-detail__comment-meta,
.ticket-detail__history-meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-1);
}

.ticket-detail__comment-actions,
.ticket-detail__attachment-actions {
  display: flex;
  gap: var(--space-2);
  margin-block-start: var(--space-2);
}

.ticket-detail__attachment {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.ticket-detail__attachment-name {
  font-weight: var(--font-weight-semibold);
}

.ticket-detail__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.ticket-detail__upload {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-block-end: var(--space-5);
  flex-wrap: wrap;
}

.ticket-detail__history-field {
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--space-1);
}

.ticket-detail__history-change {
  margin: 0 0 var(--space-1);
}
</style>
