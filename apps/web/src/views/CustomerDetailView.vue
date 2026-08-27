<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
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
import { formatBytes, toLocalDatetimeInput } from '@/utils/format';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppTabs from '@/components/AppTabs.vue';
import type { AppTab } from '@/components/tabs';

const route = useRoute();
const auth = useAuthStore();
const customers = useCustomersStore();
const { t, d, n } = useI18n();

const customerId = computed(() => route.params.id as string);

const STATUS_TONE: Record<CustomerStatus, 'ok' | 'accent' | 'neutral'> = {
  ACTIVE: 'ok',
  PROSPECT: 'accent',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
};

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

const tabs = computed<AppTab[]>(() => [
  { key: 'notes', labelKey: 'customer.tab.notes', count: customers.notes.length },
  { key: 'attachments', labelKey: 'customer.tab.attachments', count: customers.attachments.length },
  { key: 'history', labelKey: 'customer.tab.history' },
]);

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
  if (window.confirm(t('customer.detail.deleteNoteConfirm'))) {
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
  if (window.confirm(t('customer.detail.deleteAttachmentConfirm', { fileName: attachment.fileName }))) {
    await customers.removeAttachment(customerId.value, attachment.id);
  }
}

function attachmentSize(bytes: number): string {
  const { value, unitKey } = formatBytes(bytes);

  return `${n(value, 'decimal')} ${t(`common.bytes.${unitKey}`)}`;
}

// --- interactions ------------------------------------------------------------

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
  if (window.confirm(t('customer.detail.deleteInteractionConfirm'))) {
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
    <AppStateBlock v-if="customers.error && !customers.current" variant="error" :message="customers.error" />

    <template v-else-if="customers.current">
      <header class="customer-detail__header">
        <div>
          <h1>{{ customers.current.name }}</h1>
          <p v-if="customers.current.companyName" class="customer-detail__company">
            {{ customers.current.companyName }}
          </p>
        </div>

        <div class="customer-detail__controls">
          <AppBadge :tone="STATUS_TONE[customers.current.status]">
            {{ t(`customer.status.${customers.current.status}`) }}
          </AppBadge>

          <select
            v-if="auth.can('customers:write')"
            :value="customers.current.status"
            :disabled="statusSelectDisabled"
            @change="changeStatus"
          >
            <option v-for="status in statusOptions" :key="status" :value="status">
              {{ t(`customer.status.${status}`) }}
            </option>
          </select>

          <RouterLink v-if="auth.can('customers:write')" :to="`/customers/${customers.current.id}/edit`">
            {{ t('common.edit') }}
          </RouterLink>
        </div>
      </header>

      <dl class="customer-detail__overview">
        <div>
          <dt>{{ t('customer.field.email') }}</dt>
          <dd><span dir="ltr">{{ customers.current.email ?? '—' }}</span></dd>
        </div>
        <div>
          <dt>{{ t('customer.field.phone') }}</dt>
          <dd><span dir="ltr">{{ customers.current.phone ?? '—' }}</span></dd>
        </div>
        <div>
          <dt>{{ t('customer.field.alternatePhone') }}</dt>
          <dd><span dir="ltr">{{ customers.current.alternatePhone ?? '—' }}</span></dd>
        </div>
        <div>
          <dt>{{ t('customer.field.addressLine1') }}</dt>
          <dd>{{ customers.current.addressLine1 ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.addressLine2') }}</dt>
          <dd>{{ customers.current.addressLine2 ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.city') }}</dt>
          <dd>{{ customers.current.city ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.country') }}</dt>
          <dd>{{ customers.current.country ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.postalCode') }}</dt>
          <dd>{{ customers.current.postalCode ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.assignedAgent') }}</dt>
          <dd>{{ customers.current.assignedAgent?.fullName ?? t('common.unassigned') }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.createdBy') }}</dt>
          <dd>{{ customers.current.createdBy?.fullName ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.createdAt') }}</dt>
          <dd>{{ d(new Date(customers.current.createdAt), 'long') }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.updatedAt') }}</dt>
          <dd>{{ d(new Date(customers.current.updatedAt), 'long') }}</dd>
        </div>
      </dl>

      <AppTabs v-model="activeTab" :tabs="tabs" class="customer-detail__tabs" />

      <div v-if="activeTab === 'notes'" class="customer-detail__panel">
        <form v-if="auth.can('notes:write')" class="customer-detail__note-form" @submit.prevent="submitNewNote">
          <label>
            {{ t('customer.detail.addNote') }}
            <textarea v-model="newNoteBody" rows="3" required />
          </label>
          <button type="submit">{{ t('common.save') }}</button>
        </form>

        <p v-if="!customers.notes.length">{{ t('customer.detail.noNotes') }}</p>

        <ul v-else class="customer-detail__note-list">
          <li v-for="note in customers.notes" :key="note.id" class="customer-detail__note">
            <template v-if="editingNoteId === note.id">
              <textarea v-model="editingNoteBody" rows="3" />
              <div class="customer-detail__note-actions">
                <button type="button" @click="submitEditNote(note)">{{ t('common.save') }}</button>
                <button type="button" @click="cancelEditNote">{{ t('common.cancel') }}</button>
              </div>
            </template>
            <template v-else>
              <p class="customer-detail__note-meta">
                {{ note.author.fullName }} — {{ d(new Date(note.createdAt), 'long') }}
              </p>
              <p class="customer-detail__note-body">{{ note.body }}</p>
              <div v-if="isOwnNote(note)" class="customer-detail__note-actions">
                <button type="button" @click="startEditNote(note)">{{ t('common.edit') }}</button>
                <button type="button" @click="removeNote(note)">{{ t('common.delete') }}</button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <div v-else-if="activeTab === 'attachments'" class="customer-detail__panel">
        <div v-if="auth.can('attachments:write')" class="customer-detail__upload">
          <input type="file" @change="onFileChange">
          <button type="button" :disabled="!pendingFile" @click="submitUpload">{{ t('attachment.upload') }}</button>
          <p class="customer-detail__hint">{{ t('customer.detail.uploadHint') }}</p>
        </div>

        <p v-if="!customers.attachments.length">{{ t('customer.detail.noAttachments') }}</p>

        <ul v-else class="customer-detail__attachment-list">
          <li v-for="attachment in customers.attachments" :key="attachment.id" class="customer-detail__attachment">
            <span class="customer-detail__attachment-name" dir="ltr">{{ attachment.fileName }}</span>
            <span>{{ attachmentSize(attachment.sizeBytes) }}</span>
            <span>{{ attachment.uploadedBy.fullName }}</span>
            <span>{{ d(new Date(attachment.createdAt), 'long') }}</span>
            <div class="customer-detail__attachment-actions">
              <button type="button" @click="download(attachment)">{{ t('attachment.download') }}</button>
              <button v-if="auth.can('attachments:write')" type="button" @click="removeAttachment(attachment)">
                {{ t('common.delete') }}
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
            {{ t('customer.detail.channel') }}
            <select v-model="interactionForm.channel">
              <option v-for="channel in INTERACTION_CHANNELS" :key="channel" :value="channel">
                {{ t(`interaction.channel.${channel}`) }}
              </option>
            </select>
          </label>
          <label>
            {{ t('customer.detail.direction') }}
            <select v-model="interactionForm.direction">
              <option value="INBOUND">{{ t('interaction.direction.INBOUND') }}</option>
              <option value="OUTBOUND">{{ t('interaction.direction.OUTBOUND') }}</option>
            </select>
          </label>
          <label>
            {{ t('ticket.field.subject') }}
            <input v-model="interactionForm.subject" type="text" required minlength="2">
          </label>
          <label>
            {{ t('ticket.field.description') }}
            <textarea v-model="interactionForm.body" rows="3" />
          </label>
          <label>
            {{ t('customer.detail.occurredAt') }}
            <input v-model="interactionForm.occurredAt" type="datetime-local" required>
          </label>
          <button type="submit">{{ t('customer.detail.logInteraction') }}</button>
        </form>

        <p v-if="!customers.interactions.length">{{ t('customer.detail.noInteractions') }}</p>

        <ul v-else class="customer-detail__interaction-list">
          <li
            v-for="interaction in customers.interactions"
            :key="interaction.id"
            class="customer-detail__interaction"
          >
            <p class="customer-detail__interaction-meta">
              {{ t(`interaction.channel.${interaction.channel}`) }} ·
              {{ t(`interaction.direction.${interaction.direction}`) }} —
              {{ d(new Date(interaction.occurredAt), 'long') }}
            </p>
            <p class="customer-detail__interaction-subject">{{ interaction.subject }}</p>
            <p v-if="interaction.body">{{ interaction.body }}</p>
            <p class="customer-detail__interaction-meta">
              {{ t('customer.detail.loggedBy', { name: interaction.createdBy?.fullName ?? t('communication.systemAuthor') }) }}
            </p>
            <button
              v-if="auth.can('interactions:write')"
              type="button"
              @click="removeInteraction(interaction)"
            >
              {{ t('common.delete') }}
            </button>
          </li>
        </ul>

        <p class="customers__muted">
          {{ t('customer.detail.ticketingNote') }}
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.customer-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-block-end: var(--space-5);
}

.customer-detail__company {
  color: var(--color-text-muted);
}

.customer-detail__controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.customer-detail__overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  margin: 0 0 var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customer-detail__overview dt {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.customer-detail__overview dd {
  margin: 0;
}

.customer-detail__tabs {
  margin-block-end: var(--space-4);
}

.customer-detail__panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-5);
}

.customer-detail__note-form,
.customer-detail__interaction-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-block-end: var(--space-5);
}

.customer-detail__note-list,
.customer-detail__attachment-list,
.customer-detail__interaction-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.customer-detail__note,
.customer-detail__interaction {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customer-detail__note-meta,
.customer-detail__interaction-meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-1);
}

.customer-detail__note-actions,
.customer-detail__attachment-actions {
  display: flex;
  gap: var(--space-2);
  margin-block-start: var(--space-2);
}

.customer-detail__attachment {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.customer-detail__attachment-name {
  font-weight: var(--font-weight-semibold);
}

.customer-detail__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.customer-detail__upload {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-block-end: var(--space-5);
  flex-wrap: wrap;
}

.customers__muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-block-start: var(--space-4);
}
</style>
