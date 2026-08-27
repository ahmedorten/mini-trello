<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useCustomersStore } from '@/stores/customers';
import {
  CUSTOMER_STATUSES,
  type CustomerAttachment,
  type CustomerNote,
  type CustomerStatus,
} from '@/api/customers';
import { formatBytes } from '@/utils/format';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppTabs from '@/components/AppTabs.vue';
import CommunicationTimeline from '@/components/CommunicationTimeline.vue';
import AppButton from '@/components/AppButton.vue';
import AppConfirmDialog from '@/components/AppConfirmDialog.vue';
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

type PendingDelete =
  | { kind: 'note'; id: string }
  | { kind: 'attachment'; id: string; fileName: string };

const pendingDelete = ref<PendingDelete | null>(null);

const pendingDeleteMessageKey = computed(() =>
  pendingDelete.value?.kind === 'attachment'
    ? 'customer.detail.deleteAttachmentConfirm'
    : 'customer.detail.deleteNoteConfirm',
);

const pendingDeleteMessageParams = computed(() =>
  pendingDelete.value?.kind === 'attachment' ? { fileName: pendingDelete.value.fileName } : undefined,
);

function requestDeleteNote(note: CustomerNote): void {
  customers.error = null;
  pendingDelete.value = { kind: 'note', id: note.id };
}

function requestDeleteAttachment(attachment: CustomerAttachment): void {
  customers.error = null;
  pendingDelete.value = { kind: 'attachment', id: attachment.id, fileName: attachment.fileName };
}

async function confirmDelete(): Promise<void> {
  const pending = pendingDelete.value;

  if (!pending) {
    return;
  }

  pendingDelete.value = null;

  if (pending.kind === 'note') {
    await customers.removeNote(customerId.value, pending.id);
  } else {
    await customers.removeAttachment(customerId.value, pending.id);
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

function attachmentSize(bytes: number): string {
  const { value, unitKey } = formatBytes(bytes);

  return `${n(value, 'decimal')} ${t(`common.bytes.${unitKey}`)}`;
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
          <AppButton type="submit" variant="primary">{{ t('common.save') }}</AppButton>
        </form>

        <p v-if="!customers.notes.length">{{ t('customer.detail.noNotes') }}</p>

        <ul v-else class="customer-detail__note-list">
          <li v-for="note in customers.notes" :key="note.id" class="customer-detail__note">
            <template v-if="editingNoteId === note.id">
              <textarea v-model="editingNoteBody" rows="3" />
              <div class="customer-detail__note-actions">
                <AppButton variant="primary" size="sm" @click="submitEditNote(note)">{{ t('common.save') }}</AppButton>
                <AppButton variant="secondary" size="sm" @click="cancelEditNote">{{ t('common.cancel') }}</AppButton>
              </div>
            </template>
            <template v-else>
              <p class="customer-detail__note-meta">
                {{ note.author.fullName }} — {{ d(new Date(note.createdAt), 'long') }}
              </p>
              <p class="customer-detail__note-body">{{ note.body }}</p>
              <div v-if="isOwnNote(note)" class="customer-detail__note-actions">
                <AppButton variant="ghost" size="sm" @click="startEditNote(note)">{{ t('common.edit') }}</AppButton>
                <AppButton variant="danger" size="sm" @click="requestDeleteNote(note)">{{ t('common.delete') }}</AppButton>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <div v-else-if="activeTab === 'attachments'" class="customer-detail__panel">
        <div v-if="auth.can('attachments:write')" class="customer-detail__upload">
          <input type="file" @change="onFileChange">
          <AppButton variant="primary" size="sm" :disabled="!pendingFile" @click="submitUpload">
            {{ t('attachment.upload') }}
          </AppButton>
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
              <AppButton variant="ghost" size="sm" @click="download(attachment)">{{ t('attachment.download') }}</AppButton>
              <AppButton
                v-if="auth.can('attachments:write')"
                variant="danger"
                size="sm"
                @click="requestDeleteAttachment(attachment)"
              >
                {{ t('common.delete') }}
              </AppButton>
            </div>
          </li>
        </ul>
      </div>

      <div v-else class="customer-detail__panel">
        <CommunicationTimeline
          :customer-id="customerId"
          :customer-contact="{
            email: customers.current?.email ?? null,
            phone: customers.current?.phone ?? null,
          }"
        />

        <p class="customers__muted">
          {{ t('customer.detail.ticketingNote') }}
        </p>
      </div>
    </template>

    <AppConfirmDialog
      :open="pendingDelete !== null"
      :message-key="pendingDeleteMessageKey"
      :message-params="pendingDeleteMessageParams"
      @update:open="pendingDelete = null"
      @confirm="confirmDelete"
    />
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

.customer-detail__note-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-block-end: var(--space-5);
}

.customer-detail__note-list,
.customer-detail__attachment-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.customer-detail__note {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customer-detail__note-meta {
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
