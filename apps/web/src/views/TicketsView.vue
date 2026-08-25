<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
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

const auth = useAuthStore();
const tickets = useTicketsStore();

function categoryLabel(category: TicketCategory): string {
  return category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, ' ');
}

function priorityLabel(priority: TicketPriority): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function statusLabel(status: TicketStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

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

function previousPage(): void {
  if (tickets.meta && tickets.filters.page > 1) {
    tickets.setPage(tickets.filters.page - 1);
  }
}

function nextPage(): void {
  if (tickets.meta && tickets.filters.page < tickets.meta.totalPages) {
    tickets.setPage(tickets.filters.page + 1);
  }
}

onMounted(() => {
  void tickets.load();
});
</script>

<template>
  <section>
    <header class="tickets__header">
      <h1>Tickets</h1>
      <RouterLink v-if="auth.can('tickets:write')" to="/tickets/new" class="tickets__create">
        New ticket
      </RouterLink>
    </header>

    <form class="tickets__filters" @submit.prevent>
      <label>
        Search
        <input v-model="searchTerm" type="search" placeholder="Subject or description">
      </label>

      <label>
        Category
        <select @change="onCategoryFilterChange">
          <option value="">All categories</option>
          <option v-for="category in TICKET_CATEGORIES" :key="category" :value="category">
            {{ categoryLabel(category) }}
          </option>
        </select>
      </label>

      <label>
        Priority
        <select @change="onPriorityFilterChange">
          <option value="">All priorities</option>
          <option v-for="priority in TICKET_PRIORITIES" :key="priority" :value="priority">
            {{ priorityLabel(priority) }}
          </option>
        </select>
      </label>

      <label>
        Status
        <select @change="onStatusFilterChange">
          <option value="">All statuses</option>
          <option v-for="status in TICKET_STATUSES" :key="status" :value="status">
            {{ statusLabel(status) }}
          </option>
        </select>
      </label>
    </form>

    <p v-if="tickets.isLoading && !tickets.items.length">Loading tickets…</p>

    <div v-else-if="tickets.error && !tickets.items.length" role="alert" class="tickets__error">
      {{ tickets.error }}
    </div>

    <p v-else-if="!tickets.items.length">No tickets match these filters.</p>

    <template v-else>
      <div class="tickets__table-wrap">
        <table class="tickets__table">
          <caption class="sr-only">Tickets</caption>
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col">Customer</th>
              <th scope="col">Category</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Assigned agent</th>
              <th scope="col">Comments/Files</th>
              <th scope="col">Actions</th>
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
              <td>{{ categoryLabel(ticket.category) }}</td>
              <td>
                <span
                  class="tickets__badge"
                  :class="'tickets__badge--priority-' + ticket.priority.toLowerCase()"
                >
                  {{ priorityLabel(ticket.priority) }}
                </span>
              </td>
              <td>
                <span
                  class="tickets__badge"
                  :class="'tickets__badge--status-' + ticket.status.toLowerCase()"
                >
                  {{ statusLabel(ticket.status) }}
                </span>
              </td>
              <td>{{ ticket.assignedAgent?.fullName ?? '—' }}</td>
              <td>{{ ticket.counts.comments }} / {{ ticket.counts.attachments }}</td>
              <td class="tickets__actions">
                <RouterLink :to="`/tickets/${ticket.id}`">View</RouterLink>
                <RouterLink v-if="auth.can('tickets:write')" :to="`/tickets/${ticket.id}/edit`">
                  Edit
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="tickets__pagination">
        <button type="button" :disabled="!tickets.meta || tickets.meta.page <= 1" @click="previousPage">
          Previous
        </button>
        <span v-if="tickets.meta">
          Page {{ tickets.meta.page }} of {{ tickets.meta.totalPages }} — {{ tickets.meta.total }} total
        </span>
        <button
          type="button"
          :disabled="!tickets.meta || tickets.meta.page >= tickets.meta.totalPages"
          @click="nextPage"
        >
          Next
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.tickets__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.tickets__create {
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: #ffffff;
  text-decoration: none;
  font-size: 0.9rem;
}

.tickets__filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.tickets__filters label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.tickets__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  margin-bottom: 1rem;
}

.tickets__table-wrap {
  overflow-x: auto;
}

.tickets__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.tickets__table th,
.tickets__table td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.tickets__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tickets__pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.tickets__badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid var(--color-border);
}

.tickets__badge--priority-urgent,
.tickets__badge--priority-high {
  background: color-mix(in srgb, var(--color-accent) 12%, white);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.tickets__badge--priority-medium,
.tickets__badge--priority-low {
  background: color-mix(in srgb, var(--color-text-muted) 12%, white);
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.tickets__badge--status-open {
  background: color-mix(in srgb, var(--color-accent) 12%, white);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.tickets__badge--status-in_progress {
  background: color-mix(in srgb, var(--color-ok) 12%, white);
  border-color: var(--color-ok);
  color: var(--color-ok);
}

.tickets__badge--status-on_hold {
  background: color-mix(in srgb, var(--color-text-muted) 12%, white);
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.tickets__badge--status-resolved,
.tickets__badge--status-closed {
  background: color-mix(in srgb, var(--color-border) 40%, white);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}
</style>
