<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import {
  TICKET_STATUSES,
  type TicketAttachment,
  type TicketComment,
  type TicketStatus,
} from '@/api/tickets';

const route = useRoute();
const auth = useAuthStore();
const tickets = useTicketsStore();

const ticketId = computed(() => route.params.id as string);

function categoryLabel(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, ' ');
}

function priorityLabel(priority: string): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

async function changeStatus(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value as TicketStatus;

  if (tickets.current) {
    await tickets.setStatus(tickets.current.id, value);
  }
}

// --- tabs ------------------------------------------------------------------

const activeTab = ref<'comments' | 'attachments' | 'history'>('comments');

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
  if (window.confirm('Delete this comment?')) {
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
  if (window.confirm(`Delete ${attachment.fileName}?`)) {
    await tickets.removeAttachment(ticketId.value, attachment.id);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

// --- history -----------------------------------------------------------------

const HISTORY_FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  category: 'Category',
  assignedAgentId: 'Assigned agent',
};

function historyFieldLabel(field: string): string {
  return HISTORY_FIELD_LABELS[field] ?? field;
}

/** Best-effort only: TicketHistory never snapshots display names. A resolved
 *  name is shown when the UUID happens to match a currently-loaded agent;
 *  otherwise the raw UUID is shown, per the documented limitation. */
function resolveHistoryValue(field: string, value: string | null): string {
  if (field === 'assignedAgentId') {
    if (!value) {
      return 'Unassigned';
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
    <div v-if="tickets.error && !tickets.current" role="alert" class="ticket-detail__error">
      {{ tickets.error }}
    </div>

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
          <span
            class="ticket-detail__badge"
            :class="'ticket-detail__badge--status-' + tickets.current.status.toLowerCase()"
          >
            {{ statusLabel(tickets.current.status) }}
          </span>

          <select v-if="auth.can('tickets:write')" :value="tickets.current.status" @change="changeStatus">
            <option v-for="status in TICKET_STATUSES" :key="status" :value="status">
              {{ statusLabel(status) }}
            </option>
          </select>

          <RouterLink v-if="auth.can('tickets:write')" :to="`/tickets/${tickets.current.id}/edit`">
            Edit
          </RouterLink>
        </div>
      </header>

      <p class="ticket-detail__description">{{ tickets.current.description }}</p>

      <dl class="ticket-detail__overview">
        <div>
          <dt>Category</dt>
          <dd>{{ categoryLabel(tickets.current.category) }}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{{ priorityLabel(tickets.current.priority) }}</dd>
        </div>
        <div>
          <dt>Assigned to</dt>
          <dd>{{ tickets.current.assignedAgent?.fullName ?? '—' }}</dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{{ tickets.current.createdBy?.fullName ?? '—' }}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{{ new Date(tickets.current.createdAt).toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{{ new Date(tickets.current.updatedAt).toLocaleString() }}</dd>
        </div>
      </dl>

      <div class="ticket-detail__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'comments'"
          :class="{ 'ticket-detail__tab--active': activeTab === 'comments' }"
          @click="activeTab = 'comments'"
        >
          Comments ({{ tickets.comments.length }})
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'attachments'"
          :class="{ 'ticket-detail__tab--active': activeTab === 'attachments' }"
          @click="activeTab = 'attachments'"
        >
          Attachments ({{ tickets.attachments.length }})
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'history'"
          :class="{ 'ticket-detail__tab--active': activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          History
        </button>
      </div>

      <div v-if="activeTab === 'comments'" class="ticket-detail__panel">
        <form
          v-if="auth.can('ticket-comments:write')"
          class="ticket-detail__comment-form"
          @submit.prevent="submitNewComment"
        >
          <label>
            Add comment
            <textarea v-model="newCommentBody" rows="3" required />
          </label>
          <button type="submit">Save</button>
        </form>

        <p v-if="!tickets.comments.length">No comments yet.</p>

        <ul v-else class="ticket-detail__comment-list">
          <li v-for="comment in tickets.comments" :key="comment.id" class="ticket-detail__comment">
            <template v-if="editingCommentId === comment.id">
              <textarea v-model="editingCommentBody" rows="3" />
              <div class="ticket-detail__comment-actions">
                <button type="button" @click="submitEditComment(comment)">Save</button>
                <button type="button" @click="cancelEditComment">Cancel</button>
              </div>
            </template>
            <template v-else>
              <p class="ticket-detail__comment-meta">
                {{ comment.author.fullName }} — {{ new Date(comment.createdAt).toLocaleString() }}
              </p>
              <p class="ticket-detail__comment-body">{{ comment.body }}</p>
              <div
                v-if="isOwnComment(comment) || auth.can('tickets:manage')"
                class="ticket-detail__comment-actions"
              >
                <button v-if="isOwnComment(comment)" type="button" @click="startEditComment(comment)">
                  Edit
                </button>
                <button type="button" @click="removeComment(comment)">Delete</button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <div v-else-if="activeTab === 'attachments'" class="ticket-detail__panel">
        <div v-if="auth.can('ticket-attachments:write')" class="ticket-detail__upload">
          <input type="file" @change="onFileChange">
          <button type="button" :disabled="!pendingFile" @click="submitUpload">Upload</button>
          <p class="ticket-detail__hint">Up to 10 MB. PDF, images, text, CSV, Word, and Excel.</p>
        </div>

        <p v-if="!tickets.attachments.length">No attachments yet.</p>

        <ul v-else class="ticket-detail__attachment-list">
          <li v-for="attachment in tickets.attachments" :key="attachment.id" class="ticket-detail__attachment">
            <span class="ticket-detail__attachment-name">{{ attachment.fileName }}</span>
            <span>{{ formatBytes(attachment.sizeBytes) }}</span>
            <span>{{ attachment.uploadedBy.fullName }}</span>
            <span>{{ new Date(attachment.createdAt).toLocaleString() }}</span>
            <div class="ticket-detail__attachment-actions">
              <button type="button" @click="download(attachment)">Download</button>
              <button
                v-if="isOwnAttachment(attachment) || auth.can('tickets:manage')"
                type="button"
                @click="removeAttachment(attachment)"
              >
                Delete
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div v-else class="ticket-detail__panel">
        <p v-if="!tickets.history.length">No history yet.</p>

        <ul v-else class="ticket-detail__history-list">
          <li v-for="entry in tickets.history" :key="entry.id" class="ticket-detail__history-entry">
            <p class="ticket-detail__history-field">{{ historyFieldLabel(entry.field) }}</p>
            <p class="ticket-detail__history-change">
              {{ resolveHistoryValue(entry.field, entry.oldValue) }}
              →
              {{ resolveHistoryValue(entry.field, entry.newValue) }}
            </p>
            <p class="ticket-detail__history-meta">
              Changed by {{ entry.changedBy.fullName }} on {{ new Date(entry.createdAt).toLocaleString() }}
            </p>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
.ticket-detail__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.ticket-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.ticket-detail__customer {
  color: var(--color-text-muted);
}

.ticket-detail__controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ticket-detail__badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid var(--color-border);
}

.ticket-detail__badge--status-open {
  background: color-mix(in srgb, var(--color-accent) 12%, white);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.ticket-detail__badge--status-in_progress {
  background: color-mix(in srgb, var(--color-ok) 12%, white);
  border-color: var(--color-ok);
  color: var(--color-ok);
}

.ticket-detail__badge--status-on_hold {
  background: color-mix(in srgb, var(--color-text-muted) 12%, white);
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.ticket-detail__badge--status-resolved,
.ticket-detail__badge--status-closed {
  background: color-mix(in srgb, var(--color-border) 40%, white);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.ticket-detail__description {
  white-space: pre-wrap;
  margin: 0 0 1.5rem;
  padding: 1rem 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-detail__overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin: 0 0 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-detail__overview dt {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.ticket-detail__overview dd {
  margin: 0;
}

.ticket-detail__tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.ticket-detail__tabs button {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font: inherit;
}

.ticket-detail__tab--active {
  color: var(--color-accent);
  border-bottom: 2px solid var(--color-accent);
}

.ticket-detail__panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.5rem;
}

.ticket-detail__comment-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.ticket-detail__comment-list,
.ticket-detail__attachment-list,
.ticket-detail__history-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ticket-detail__comment,
.ticket-detail__history-entry {
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-detail__comment-meta,
.ticket-detail__history-meta {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0 0 0.25rem;
}

.ticket-detail__comment-actions,
.ticket-detail__attachment-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.ticket-detail__attachment {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.ticket-detail__attachment-name {
  font-weight: 600;
}

.ticket-detail__hint {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.ticket-detail__upload {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.ticket-detail__history-field {
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.ticket-detail__history-change {
  margin: 0 0 0.25rem;
}
</style>
