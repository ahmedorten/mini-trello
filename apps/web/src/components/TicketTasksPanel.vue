<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTasksStore } from '@/stores/tasks';
import type { AgentTask } from '@/api/tasks';
import AppButton from './AppButton.vue';
import AppBadge from './AppBadge.vue';
import AppStateBlock from './AppStateBlock.vue';
import TaskFormModal from './TaskFormModal.vue';

const props = defineProps<{
  ticketId: string;
  customerId: string;
}>();

const auth = useAuthStore();
const tasks = useTasksStore();
const { t, d } = useI18n();

function load(): void {
  void tasks.loadForTicket(props.ticketId);
}

watch(() => props.ticketId, load);

onMounted(load);

const isModalOpen = ref(false);
const editingTask = ref<AgentTask | null>(null);

function openCreate(): void {
  editingTask.value = null;
  isModalOpen.value = true;
}

function openEdit(task: AgentTask): void {
  editingTask.value = task;
  isModalOpen.value = true;
}

async function toggleComplete(task: AgentTask): Promise<void> {
  const nextStatus = task.status === 'DONE' ? 'OPEN' : 'DONE';
  await tasks.setStatus(task.id, nextStatus, true, props.ticketId);
}
</script>

<template>
  <section v-if="auth.can('tasks:read')" class="ticket-tasks-panel">
    <header class="ticket-tasks-panel__header">
      <h3>{{ t('nav.tasks') }}</h3>
      <AppButton v-if="auth.can('tasks:write')" variant="secondary" size="sm" icon="plus" @click="openCreate">
        {{ t('task.new') }}
      </AppButton>
    </header>

    <AppStateBlock v-if="!tasks.ticketTasks.length" variant="empty" :message="t('task.empty')" />

    <ul v-else class="ticket-tasks-panel__list">
      <li v-for="task in tasks.ticketTasks" :key="task.id" class="ticket-tasks-panel__item">
        <label class="ticket-tasks-panel__checkbox">
          <input
            type="checkbox"
            :checked="task.status === 'DONE'"
            :disabled="!auth.can('tasks:write')"
            @change="toggleComplete(task)"
          >
          <span :class="{ 'ticket-tasks-panel__title--done': task.status === 'DONE' }">{{ task.title }}</span>
        </label>

        <AppBadge v-if="task.isOverdue" tone="error">{{ t('task.overdue') }}</AppBadge>

        <span v-if="task.dueAt" class="ticket-tasks-panel__due">{{ d(new Date(task.dueAt), 'long') }}</span>

        <AppButton v-if="auth.can('tasks:write')" variant="ghost" size="sm" icon="edit" icon-only :aria-label="t('common.edit')" @click="openEdit(task)" />
      </li>
    </ul>

    <TaskFormModal
      v-model:open="isModalOpen"
      :task="editingTask"
      :ticket-id="ticketId"
      :customer-id="customerId"
      from-ticket-panel
    />
  </section>
</template>

<style scoped>
.ticket-tasks-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ticket-tasks-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-tasks-panel__header h3 {
  margin: 0;
  font-size: var(--font-size-md);
}

.ticket-tasks-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ticket-tasks-panel__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}

.ticket-tasks-panel__checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-inline-size: 0;
}

.ticket-tasks-panel__title--done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.ticket-tasks-panel__due {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
</style>
