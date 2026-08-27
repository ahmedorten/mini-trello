<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTasksStore } from '@/stores/tasks';
import { AGENT_TASK_STATUSES, type AgentTask, type AgentTaskStatus } from '@/api/tasks';
import { toLocalDatetimeInput } from '@/utils/format';
import AppModal from './AppModal.vue';
import AppButton from './AppButton.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    task?: AgentTask | null;
    ticketId?: string;
    customerId?: string;
    fromTicketPanel?: boolean;
  }>(),
  { task: null, ticketId: undefined, customerId: undefined, fromTicketPanel: false },
);

const emit = defineEmits<{ 'update:open': [boolean] }>();

const auth = useAuthStore();
const tasks = useTasksStore();
const { t } = useI18n();

const isEdit = computed(() => props.task !== null);

const form = reactive({
  title: '',
  notes: '',
  status: 'OPEN' as AgentTaskStatus,
  dueAt: '',
  remindAt: '',
  assigneeId: '',
});

function resetForm(): void {
  const current = props.task;

  form.title = current?.title ?? '';
  form.notes = current?.notes ?? '';
  form.status = current?.status ?? 'OPEN';
  form.dueAt = current?.dueAt ? toLocalDatetimeInput(new Date(current.dueAt)) : '';
  form.remindAt = current?.remindAt ? toLocalDatetimeInput(new Date(current.remindAt)) : '';
  form.assigneeId = current?.assignee.id ?? '';
}

// Re-copy from the store/prop every time the modal opens, never binding an
// input directly to `task` — the CustomerFormView pattern (this story's
// direct template).
function onOpenChange(isOpen: boolean): void {
  if (isOpen) {
    resetForm();

    if (auth.can('tasks:manage') && tasks.agents.length === 0) {
      void tasks.loadAgents();
    }
  }
}

watch(() => props.open, onOpenChange);

onMounted(() => onOpenChange(props.open));

function close(): void {
  emit('update:open', false);
}

async function submit(): Promise<void> {
  const dueAtIso = form.dueAt ? new Date(form.dueAt).toISOString() : null;
  const remindAtIso = form.remindAt ? new Date(form.remindAt).toISOString() : null;
  const assigneeId = auth.can('tasks:manage') ? form.assigneeId || undefined : undefined;

  let ok: boolean;

  if (isEdit.value && props.task) {
    ok = await tasks.update(
      props.task.id,
      {
        title: form.title,
        notes: form.notes || null,
        status: form.status,
        dueAt: dueAtIso,
        remindAt: remindAtIso,
        assigneeId,
      },
      props.fromTicketPanel,
      props.ticketId,
    );
  } else {
    ok = await tasks.create(
      {
        title: form.title,
        notes: form.notes || undefined,
        status: form.status,
        dueAt: dueAtIso ?? undefined,
        remindAt: remindAtIso ?? undefined,
        assigneeId,
        ticketId: props.ticketId || undefined,
        customerId: props.customerId || undefined,
      },
      props.fromTicketPanel,
      props.ticketId,
    );
  }

  if (ok) {
    close();
  }
}
</script>

<template>
  <AppModal :open="open" :title-key="isEdit ? 'task.edit' : 'task.new'" @update:open="emit('update:open', $event)">
    <form class="task-form-modal" @submit.prevent="submit">
      <div v-if="tasks.error" role="alert" class="task-form-modal__error">{{ tasks.error }}</div>

      <label>
        {{ t('task.title') }}
        <input v-model="form.title" type="text" required minlength="2">
      </label>

      <label>
        {{ t('customer.detail.addNote') }}
        <textarea v-model="form.notes" rows="3" />
      </label>

      <label>
        {{ t('ticket.field.status') }}
        <select v-model="form.status">
          <option v-for="status in AGENT_TASK_STATUSES" :key="status" :value="status">
            {{ t(`task.status.${status}`) }}
          </option>
        </select>
      </label>

      <label>
        {{ t('task.due') }}
        <input v-model="form.dueAt" type="datetime-local">
      </label>

      <label>
        {{ t('task.remind') }}
        <input v-model="form.remindAt" type="datetime-local">
      </label>

      <label v-if="auth.can('tasks:manage')">
        {{ t('task.assignee') }}
        <select v-model="form.assigneeId">
          <option value="">{{ t('common.unassigned') }}</option>
          <option v-for="agent in tasks.agents" :key="agent.id" :value="agent.id">{{ agent.fullName }}</option>
        </select>
      </label>

      <div class="task-form-modal__actions">
        <AppButton type="submit" variant="primary" :loading="tasks.isSaving" :disabled="form.title.trim().length < 2">
          {{ t('common.save') }}
        </AppButton>
        <AppButton type="button" variant="ghost" @click="close">{{ t('common.cancel') }}</AppButton>
      </div>
    </form>
  </AppModal>
</template>

<style scoped>
.task-form-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.task-form-modal label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.task-form-modal__error {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.task-form-modal__actions {
  display: flex;
  gap: var(--space-2);
}
</style>
