<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTasksStore } from '@/stores/tasks';
import { AGENT_TASK_STATUSES, type AgentTask, type AgentTaskScope, type AgentTaskStatus } from '@/api/tasks';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppButton from '@/components/AppButton.vue';
import AppPagination from '@/components/AppPagination.vue';
import TaskFormModal from '@/components/TaskFormModal.vue';

const auth = useAuthStore();
const tasks = useTasksStore();
const { t, d } = useI18n();

function onScopeChange(event: Event): void {
  tasks.setScopeFilter((event.target as HTMLSelectElement).value as AgentTaskScope);
}

function onStatusChange(event: Event): void {
  tasks.setStatusFilter((event.target as HTMLSelectElement).value as AgentTaskStatus | '');
}

function onOverdueOnlyChange(event: Event): void {
  tasks.setOverdueOnly((event.target as HTMLInputElement).checked);
}

function onPageChange(page: number): void {
  tasks.setPage(page);
}

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
  await tasks.setStatus(task.id, nextStatus);
}

async function remove(task: AgentTask): Promise<void> {
  if (window.confirm(t('task.confirmDelete'))) {
    await tasks.remove(task.id);
  }
}

const canSeeAllScope = computed(() => auth.can('tasks:manage'));

onMounted(() => {
  void tasks.load();
});
</script>

<template>
  <section>
    <header class="tasks__header">
      <h1>{{ t('nav.tasks') }}</h1>
      <AppButton v-if="auth.can('tasks:write')" variant="primary" icon="plus" @click="openCreate">
        {{ t('task.new') }}
      </AppButton>
    </header>

    <form class="tasks__filters" @submit.prevent>
      <label>
        {{ t('task.scope.mine') }}
        <select :value="tasks.filters.scope" @change="onScopeChange">
          <option value="mine">{{ t('task.scope.mine') }}</option>
          <option v-if="canSeeAllScope" value="all">{{ t('task.scope.all') }}</option>
        </select>
      </label>

      <label>
        {{ t('ticket.field.status') }}
        <select :value="tasks.filters.status" @change="onStatusChange">
          <option value="">{{ t('common.all') }}</option>
          <option v-for="status in AGENT_TASK_STATUSES" :key="status" :value="status">
            {{ t(`task.status.${status}`) }}
          </option>
        </select>
      </label>

      <label class="tasks__overdue-only">
        <input type="checkbox" :checked="tasks.filters.overdueOnly" @change="onOverdueOnlyChange">
        {{ t('task.overdueOnly') }}
      </label>
    </form>

    <AppStateBlock v-if="tasks.isLoading && !tasks.items.length" variant="loading" :message="t('common.loading')" />

    <AppStateBlock v-else-if="tasks.error && !tasks.items.length" variant="error" :message="tasks.error" />

    <AppStateBlock v-else-if="!tasks.items.length" variant="empty" :message="t('task.empty')" />

    <template v-else>
      <div class="tasks__table-wrap">
        <table class="tasks__table">
          <caption class="sr-only">{{ t('nav.tasks') }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ t('task.title') }}</th>
              <th scope="col">{{ t('ticket.field.status') }}</th>
              <th scope="col">{{ t('task.due') }}</th>
              <th scope="col">{{ t('task.linkedTicket') }}</th>
              <th scope="col">{{ t('task.linkedCustomer') }}</th>
              <th scope="col">{{ t('task.assignee') }}</th>
              <th scope="col">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks.items" :key="task.id">
              <td>{{ task.title }}</td>
              <td>
                <AppBadge :tone="task.isOverdue ? 'error' : 'neutral'">{{ t(`task.status.${task.status}`) }}</AppBadge>
              </td>
              <td>{{ task.dueAt ? d(new Date(task.dueAt), 'long') : '—' }}</td>
              <td>
                <RouterLink v-if="task.ticket" :to="`/workspace/${task.ticket.id}`">{{ task.ticket.subject }}</RouterLink>
                <span v-else>—</span>
              </td>
              <td>
                <RouterLink v-if="task.customer" :to="`/customers/${task.customer.id}`">{{ task.customer.name }}</RouterLink>
                <span v-else>—</span>
              </td>
              <td>{{ task.assignee.fullName }}</td>
              <td class="tasks__actions">
                <button type="button" @click="toggleComplete(task)">
                  {{ task.status === 'DONE' ? t('task.reopen') : t('task.complete') }}
                </button>
                <button v-if="auth.can('tasks:write')" type="button" @click="openEdit(task)">{{ t('common.edit') }}</button>
                <button v-if="auth.can('tasks:write')" type="button" @click="remove(task)">{{ t('common.delete') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination
        v-if="tasks.meta"
        :page="tasks.meta.page"
        :total-pages="tasks.meta.totalPages"
        :total="tasks.meta.total"
        @change="onPageChange"
      />
    </template>

    <TaskFormModal v-model:open="isModalOpen" :task="editingTask" />
  </section>
</template>

<style scoped>
.tasks__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: var(--space-5);
}

.tasks__filters {
  display: flex;
  gap: var(--space-4);
  margin-block-end: var(--space-5);
  flex-wrap: wrap;
  align-items: flex-end;
}

.tasks__filters label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.tasks__overdue-only {
  flex-direction: row !important;
  align-items: center;
  gap: var(--space-2) !important;
}

.tasks__table-wrap {
  overflow-x: auto;
}

.tasks__table {
  inline-size: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.tasks__table th,
.tasks__table td {
  text-align: start;
  padding: var(--space-3);
  border-block-end: 1px solid var(--color-border);
}

.tasks__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
