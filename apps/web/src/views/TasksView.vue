<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTasksStore } from '@/stores/tasks';
import {
  AGENT_TASK_STATUSES,
  type AgentTask,
  type AgentTaskScope,
  type AgentTaskSortField,
  type AgentTaskStatus,
} from '@/api/tasks';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppButton from '@/components/AppButton.vue';
import AppPagination from '@/components/AppPagination.vue';
import AppSortHeader from '@/components/AppSortHeader.vue';
import TaskFormModal from '@/components/TaskFormModal.vue';
import AppConfirmDialog from '@/components/AppConfirmDialog.vue';

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

function onPageSizeChange(pageSize: number): void {
  tasks.setPageSize(pageSize);
}

// AppSortHeader emits a bare string — the field prop values are typed at each
// call site, but the emit itself cannot carry a per-view union.
function onSort(field: string): void {
  tasks.setSort(field as AgentTaskSortField);
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

// --- destructive confirmation -------------------------------------------

const pendingDelete = ref<AgentTask | null>(null);

function requestDelete(task: AgentTask): void {
  // Product rule 8: never open a dialog on top of a stale error.
  tasks.error = null;
  pendingDelete.value = task;
}

async function confirmDelete(): Promise<void> {
  const task = pendingDelete.value;

  if (!task) {
    return;
  }

  pendingDelete.value = null;
  await tasks.remove(task.id);
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

    <form class="filter-bar" @submit.prevent>
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
      <div class="data-table-wrap">
        <table class="data-table">
          <caption class="sr-only">{{ t('nav.tasks') }}</caption>
          <thead>
            <tr>
              <AppSortHeader field="title" :label="t('task.title')" :active-field="tasks.filters.sort" :active-order="tasks.filters.order" @sort="onSort" />
              <AppSortHeader field="status" :label="t('ticket.field.status')" :active-field="tasks.filters.sort" :active-order="tasks.filters.order" @sort="onSort" />
              <AppSortHeader field="dueAt" :label="t('task.due')" :active-field="tasks.filters.sort" :active-order="tasks.filters.order" @sort="onSort" />
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
              <td class="data-table__actions">
                <AppButton variant="ghost" size="sm" @click="toggleComplete(task)">
                  {{ task.status === 'DONE' ? t('task.reopen') : t('task.complete') }}
                </AppButton>
                <AppButton v-if="auth.can('tasks:write')" variant="ghost" size="sm" @click="openEdit(task)">
                  {{ t('common.edit') }}
                </AppButton>
                <AppButton v-if="auth.can('tasks:write')" variant="danger" size="sm" @click="requestDelete(task)">
                  {{ t('common.delete') }}
                </AppButton>
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
        :page-size="tasks.meta.pageSize"
        @change="onPageChange"
        @page-size-change="onPageSizeChange"
      />
    </template>

    <TaskFormModal v-model:open="isModalOpen" :task="editingTask" />

    <AppConfirmDialog
      :open="pendingDelete !== null"
      message-key="task.confirmDelete"
      @update:open="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.tasks__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: var(--space-5);
}

.tasks__overdue-only {
  flex-direction: row !important;
  align-items: center;
  gap: var(--space-2) !important;
}
</style>
