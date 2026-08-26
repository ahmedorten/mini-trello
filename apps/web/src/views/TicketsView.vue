<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@/api/tickets';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppPagination from '@/components/AppPagination.vue';
import AppIcon from '@/components/AppIcon.vue';

const auth = useAuthStore();
const tickets = useTicketsStore();
const { t } = useI18n();

// --- filters -------------------------------------------------------------

const searchTerm = ref(tickets.filters.search ?? '');
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

watch(searchTerm, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  searchDebounce = setTimeout(() => {
    tickets.setSearch(value);
  }, 300);
});

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
});

function onCategoryFilterChange(event: Event): void {
  tickets.setCategoryFilter((event.target as HTMLSelectElement).value as TicketCategory | '');
}

function onPriorityFilterChange(event: Event): void {
  tickets.setPriorityFilter((event.target as HTMLSelectElement).value as TicketPriority | '');
}

function onStatusFilterChange(event: Event): void {
  tickets.setStatusFilter((event.target as HTMLSelectElement).value as TicketStatus | '');
}

function onPageChange(page: number): void {
  tickets.setPage(page);
}

onMounted(() => {
  void tickets.load();
});
</script>

<template>
  <section>
    <header class="tickets__header">
      <h1>{{ t('ticket.list.title') }}</h1>
      <RouterLink v-if="auth.can('tickets:write')" to="/tickets/new" class="tickets__create">
        <AppIcon name="plus" :size="16" />
        {{ t('ticket.list.newTicket') }}
      </RouterLink>
    </header>

    <form class="tickets__filters" @submit.prevent>
      <label>
        {{ t('common.search') }}
        <input v-model="searchTerm" type="search" :placeholder="t('ticket.list.searchPlaceholder')">
      </label>

      <label>
        {{ t('ticket.field.category') }}
        <select @change="onCategoryFilterChange">
          <option value="">{{ t('ticket.list.allCategories') }}</option>
          <option v-for="category in TICKET_CATEGORIES" :key="category" :value="category">
            {{ t(`ticket.category.${category}`) }}
          </option>
        </select>
      </label>

      <label>
        {{ t('ticket.field.priority') }}
        <select @change="onPriorityFilterChange">
          <option value="">{{ t('ticket.list.allPriorities') }}</option>
          <option v-for="priority in TICKET_PRIORITIES" :key="priority" :value="priority">
            {{ t(`ticket.priority.${priority}`) }}
          </option>
        </select>
      </label>

      <label>
        {{ t('ticket.field.status') }}
        <select @change="onStatusFilterChange">
          <option value="">{{ t('ticket.list.allStatuses') }}</option>
          <option v-for="status in TICKET_STATUSES" :key="status" :value="status">
            {{ t(`ticket.status.${status}`) }}
          </option>
        </select>
      </label>
    </form>

    <AppStateBlock v-if="tickets.isLoading && !tickets.items.length" variant="loading" :message="t('ticket.list.loading')" />

    <AppStateBlock
      v-else-if="tickets.error && !tickets.items.length"
      variant="error"
      :message="tickets.error"
      class="tickets__error"
    />

    <AppStateBlock v-else-if="!tickets.items.length" variant="empty" :message="t('ticket.list.empty')" />

    <template v-else>
      <div class="tickets__table-wrap">
        <table class="tickets__table">
          <caption class="sr-only">{{ t('ticket.list.caption') }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ t('ticket.field.subject') }}</th>
              <th scope="col">{{ t('ticket.field.customer') }}</th>
              <th scope="col">{{ t('ticket.field.category') }}</th>
              <th scope="col">{{ t('ticket.field.priority') }}</th>
              <th scope="col">{{ t('ticket.field.status') }}</th>
              <th scope="col">{{ t('ticket.field.assignedAgent') }}</th>
              <th scope="col">{{ t('ticket.field.commentsFiles') }}</th>
              <th scope="col">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ticket in tickets.items" :key="ticket.id">
              <td>
                <RouterLink :to="`/tickets/${ticket.id}`">{{ ticket.subject }}</RouterLink>
              </td>
              <td>
                <RouterLink :to="`/customers/${ticket.customer.id}`">{{ ticket.customer.name }}</RouterLink>
              </td>
              <td>{{ t(`ticket.category.${ticket.category}`) }}</td>
              <td>
                <AppBadge :priority="ticket.priority" />
              </td>
              <td>
                <AppBadge :status="ticket.status" />
              </td>
              <td>{{ ticket.assignedAgent?.fullName ?? t('common.unassigned') }}</td>
              <td>{{ ticket.counts.comments }} / {{ ticket.counts.attachments }}</td>
              <td class="tickets__actions">
                <RouterLink :to="`/tickets/${ticket.id}`">{{ t('common.view') }}</RouterLink>
                <RouterLink v-if="auth.can('tickets:write')" :to="`/tickets/${ticket.id}/edit`">
                  {{ t('common.edit') }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="tickets__pagination">
        <AppPagination
          v-if="tickets.meta"
          :page="tickets.meta.page"
          :total-pages="tickets.meta.totalPages"
          :total="tickets.meta.total"
          @change="onPageChange"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.tickets__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: var(--space-5);
}

.tickets__create {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius);
  background: var(--color-accent);
  color: var(--color-on-accent);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.tickets__filters {
  display: flex;
  gap: var(--space-4);
  margin-block-end: var(--space-5);
  flex-wrap: wrap;
}

.tickets__filters label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.tickets__error {
  margin-block-end: var(--space-4);
}

.tickets__table-wrap {
  overflow-x: auto;
}

.tickets__table {
  inline-size: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.tickets__table th,
.tickets__table td {
  text-align: start;
  padding: var(--space-3) var(--space-3);
  border-block-end: 1px solid var(--color-border);
}

.tickets__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
