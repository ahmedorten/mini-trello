<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useCustomersStore } from '@/stores/customers';
import {
  CUSTOMER_STATUSES,
  INTERACTION_CHANNELS,
  type CustomerAttachment,
  type CustomerInteraction,
  type CustomerNote,
  type CustomerStatus,
  type InteractionChannel,
  type InteractionDirection,
} from '@/api/customers';

const route = useRoute();
const auth = useAuthStore();
const customers = useCustomersStore();

const customerId = computed(() => route.params.id as string);

function statusLabel(status: CustomerStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

const statusOptions = computed(() =>
  CUSTOMER_STATUSES.filter((status) => status !== 'ARCHIVED' || auth.can('customers:archive')),
);

// When already ARCHIVED without customers:archive, every transition away
// would 403 — a control that always fails is worse than no control.
const statusSelectDisabled = computed(
  () => customers.current?.status === 'ARCHIVED' && !auth.can('customers:archive'),
);

async function changeStatus(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value as CustomerStatus;

  if (customers.current) {
    await customers.setStatus(customers.current.id, value);
  }
}

// --- tabs ------------------------------------------------------------------

const activeTab = ref<'notes' | 'attachments' | 'history'>('notes');

// --- notes -----------------------------------------------------------------

const newNoteBody = ref('');
const editingNoteId = ref<string | null>(null);
const editingNoteBody = ref('');

function isOwnNote(note: CustomerNote): boolean {
  return note.author.id === auth.user?.id;
}

async function submitNewNote(): Promise<void> {
  if (!newNoteBody.value.trim()) {
    return;
  }

  const ok = await customers.addNote(customerId.value, { body: newNoteBody.value });

  if (ok) {
    newNoteBody.value = '';
  }
}

function startEditNote(note: CustomerNote): void {
  editingNoteId.value = note.id;
  editingNoteBody.value = note.body;
}

function cancelEditNote(): void {
  editingNoteId.value = null;
}

async function submitEditNote(note: CustomerNote): Promise<void> {
  const ok = await customers.editNote(customerId.value, note.id, { body: editingNoteBody.value });

  if (ok) {
    editingNoteId.value = null;
  }
}

async function removeNote(note: CustomerNote): Promise<void> {
  if (window.confirm('Delete this note?')) {
    await customers.removeNote(customerId.value, note.id);
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

  const ok = await customers.uploadFile(customerId.value, pendingFile.value);

  if (ok) {
    pendingFile.value = null;
  }
}

async function download(attachment: CustomerAttachment): Promise<void> {
  await customers.downloadFile(customerId.value, attachment);
}

async function removeAttachment(attachment: CustomerAttachment): Promise<void> {
  if (window.confirm(`Delete ${attachment.fileName}?`)) {
    await customers.removeAttachment(customerId.value, attachment.id);
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

// --- interactions ------------------------------------------------------------

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const interactionForm = reactive({
  channel: 'PHONE' as InteractionChannel,
  direction: 'OUTBOUND' as InteractionDirection,
  subject: '',
  body: '',
  occurredAt: toLocalDatetimeInput(new Date()),
});

async function submitInteraction(): Promise<void> {
  // datetime-local yields a local, zoneless string; the API needs a real ISO
  // instant, or an agent east of UTC could trip the future-timestamp check.
  const occurredAtIso = new Date(interactionForm.occurredAt).toISOString();

  const ok = await customers.addInteraction(customerId.value, {
    channel: interactionForm.channel,
    direction: interactionForm.direction,
    subject: interactionForm.subject,
    body: interactionForm.body || undefined,
    occurredAt: occurredAtIso,
  });

  if (ok) {
    interactionForm.subject = '';
    interactionForm.body = '';
    interactionForm.occurredAt = toLocalDatetimeInput(new Date());
  }
}

async function removeInteraction(interaction: CustomerInteraction): Promise<void> {
  if (window.confirm('Delete this interaction?')) {
    await customers.removeInteraction(customerId.value, interaction.id);
  }
}

onMounted(() => {
  void customers.loadDetail(customerId.value);
});

onUnmounted(() => {
  customers.clearDetail();
});
</script>

<template>
  <section>
    <div v-if="customers.error && !customers.current" role="alert" class="customer-detail__error">
      {{ customers.error }}
    </div>

    <template v-else-if="customers.current">
      <header class="customer-detail__header">
        <div>
          <h1>{{ customers.current.name }}</h1>
          <p v-if="customers.current.companyName" class="customer-detail__company">
            {{ customers.current.companyName }}
          </p>
        </div>

        <div class="customer-detail__controls">
          <span
            class="customer-detail__badge"
            :class="'customer-detail__badge--' + customers.current.status.toLowerCase()"
          >
            {{ statusLabel(customers.current.status) }}
          </span>

          <select
            v-if="auth.can('customers:write')"
            :value="customers.current.status"
            :disabled="statusSelectDisabled"
            @change="changeStatus"
          >
            <option v-for="status in statusOptions" :key="status" :value="status">
              {{ statusLabel(status) }}
            </option>
          </select>

          <RouterLink v-if="auth.can('customers:write')" :to="`/customers/${customers.current.id}/edit`">
            Edit
          </RouterLink>
        </div>
      </header>

      <dl class="customer-detail__overview">
        <div>
          <dt>Email</dt>
          <dd>{{ customers.current.email ?? '—' }}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{{ customers.current.phone ?? '—' }}</dd>
        </div>
        <div>
          <dt>Alternate phone</dt>
          <dd>{{ customers.current.alternatePhone ?? '—' }}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{{ customers.current.addressLine1 ?? '—' }}</dd>
        </div>
        <div>
          <dt>Address line 2</dt>
          <dd>{{ customers.current.addressLine2 ?? '—' }}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{{ customers.current.city ?? '—' }}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{{ customers.current.country ?? '—' }}</dd>
        </div>
        <div>
          <dt>Postal code</dt>
          <dd>{{ customers.current.postalCode ?? '—' }}</dd>
        </div>
        <div>
          <dt>Assigned to</dt>
          <dd>{{ customers.current.assignedAgent?.fullName ?? '—' }}</dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{{ customers.current.createdBy?.fullName ?? '—' }}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{{ new Date(customers.current.createdAt).toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{{ new Date(customers.current.updatedAt).toLocaleString() }}</dd>
        </div>
      </dl>

      <div class="customer-detail__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'notes'"
          :class="{ 'customer-detail__tab--active': activeTab === 'notes' }"
          @click="activeTab = 'notes'"
        >
          Notes ({{ customers.notes.length }})
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'attachments'"
          :class="{ 'customer-detail__tab--active': activeTab === 'attachments' }"
          @click="activeTab = 'attachments'"
        >
          Attachments ({{ customers.attachments.length }})
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'history'"
          :class="{ 'customer-detail__tab--active': activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          History
        </button>
      </div>

      <div v-if="activeTab === 'notes'" class="customer-detail__panel">
        <form v-if="auth.can('notes:write')" class="customer-detail__note-form" @submit.prevent="submitNewNote">
          <label>
            Add note
            <textarea v-model="newNoteBody" rows="3" required />
          </label>
          <button type="submit">Save</button>
        </form>

        <p v-if="!customers.notes.length">No notes yet.</p>

        <ul v-else class="customer-detail__note-list">
          <li v-for="note in customers.notes" :key="note.id" class="customer-detail__note">
            <template v-if="editingNoteId === note.id">
              <textarea v-model="editingNoteBody" rows="3" />
              <div class="customer-detail__note-actions">
                <button type="button" @click="submitEditNote(note)">Save</button>
                <button type="button" @click="cancelEditNote">Cancel</button>
              </div>
            </template>
            <template v-else>
              <p class="customer-detail__note-meta">
                {{ note.author.fullName }} — {{ new Date(note.createdAt).toLocaleString() }}
              </p>
              <p class="customer-detail__note-body">{{ note.body }}</p>
              <div v-if="isOwnNote(note)" class="customer-detail__note-actions">
                <button type="button" @click="startEditNote(note)">Edit</button>
                <button type="button" @click="removeNote(note)">Delete</button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <div v-else-if="activeTab === 'attachments'" class="customer-detail__panel">
        <div v-if="auth.can('attachments:write')" class="customer-detail__upload">
          <input type="file" @change="onFileChange">
          <button type="button" :disabled="!pendingFile" @click="submitUpload">Upload</button>
          <p class="customer-detail__hint">Up to 10 MB. PDF, images, text, CSV, Word, and Excel.</p>
        </div>

        <p v-if="!customers.attachments.length">No attachments yet.</p>

        <ul v-else class="customer-detail__attachment-list">
          <li v-for="attachment in customers.attachments" :key="attachment.id" class="customer-detail__attachment">
            <span class="customer-detail__attachment-name">{{ attachment.fileName }}</span>
            <span>{{ formatBytes(attachment.sizeBytes) }}</span>
            <span>{{ attachment.uploadedBy.fullName }}</span>
            <span>{{ new Date(attachment.createdAt).toLocaleString() }}</span>
            <div class="customer-detail__attachment-actions">
              <button type="button" @click="download(attachment)">Download</button>
              <button v-if="auth.can('attachments:write')" type="button" @click="removeAttachment(attachment)">
                Delete
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div v-else class="customer-detail__panel">
        <form
          v-if="auth.can('interactions:write')"
          class="customer-detail__interaction-form"
          @submit.prevent="submitInteraction"
        >
          <label>
            Channel
            <select v-model="interactionForm.channel">
              <option v-for="channel in INTERACTION_CHANNELS" :key="channel" :value="channel">{{ channel }}</option>
            </select>
          </label>
          <label>
            Direction
            <select v-model="interactionForm.direction">
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>
          </label>
          <label>
            Subject
            <input v-model="interactionForm.subject" type="text" required minlength="2">
          </label>
          <label>
            Body
            <textarea v-model="interactionForm.body" rows="3" />
          </label>
          <label>
            Occurred at
            <input v-model="interactionForm.occurredAt" type="datetime-local" required>
          </label>
          <button type="submit">Log interaction</button>
        </form>

        <p v-if="!customers.interactions.length">No interactions logged yet.</p>

        <ul v-else class="customer-detail__interaction-list">
          <li
            v-for="interaction in customers.interactions"
            :key="interaction.id"
            class="customer-detail__interaction"
          >
            <p class="customer-detail__interaction-meta">
              {{ interaction.channel }} · {{ interaction.direction }} —
              {{ new Date(interaction.occurredAt).toLocaleString() }}
            </p>
            <p class="customer-detail__interaction-subject">{{ interaction.subject }}</p>
            <p v-if="interaction.body">{{ interaction.body }}</p>
            <p class="customer-detail__interaction-meta">
              Logged by {{ interaction.createdBy.fullName }}
            </p>
            <button
              v-if="auth.can('interactions:write')"
              type="button"
              @click="removeInteraction(interaction)"
            >
              Delete
            </button>
          </li>
        </ul>

        <p class="customers__muted">
          Support tickets will appear in this timeline once ticketing ships. Interactions logged here
          are the current history.
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.customer-detail__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.customer-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.customer-detail__company {
  color: var(--color-text-muted);
}

.customer-detail__controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.customer-detail__badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid var(--color-border);
}

.customer-detail__badge--active {
  background: color-mix(in srgb, var(--color-ok) 12%, white);
  border-color: var(--color-ok);
  color: var(--color-ok);
}

.customer-detail__badge--prospect {
  background: color-mix(in srgb, var(--color-accent) 12%, white);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.customer-detail__badge--inactive {
  background: color-mix(in srgb, var(--color-text-muted) 12%, white);
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.customer-detail__badge--archived {
  background: color-mix(in srgb, var(--color-border) 40%, white);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.customer-detail__overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin: 0 0 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customer-detail__overview dt {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.customer-detail__overview dd {
  margin: 0;
}

.customer-detail__tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.customer-detail__tabs button {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font: inherit;
}

.customer-detail__tab--active {
  color: var(--color-accent);
  border-bottom: 2px solid var(--color-accent);
}

.customer-detail__panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.5rem;
}

.customer-detail__note-form,
.customer-detail__interaction-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.customer-detail__note-list,
.customer-detail__attachment-list,
.customer-detail__interaction-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.customer-detail__note,
.customer-detail__interaction {
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customer-detail__note-meta,
.customer-detail__interaction-meta {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0 0 0.25rem;
}

.customer-detail__note-actions,
.customer-detail__attachment-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.customer-detail__attachment {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.customer-detail__attachment-name {
  font-weight: 600;
}

.customer-detail__hint {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.customer-detail__upload {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.customers__muted {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin-top: 1rem;
}
</style>
