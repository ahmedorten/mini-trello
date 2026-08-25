<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useCustomersStore } from '@/stores/customers';
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, type CustomerStatus, type CustomerType } from '@/api/customers';

const auth = useAuthStore();
const customers = useCustomersStore();

function statusLabel(status: CustomerStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function typeLabel(type: CustomerType): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

// --- filters -------------------------------------------------------------

const searchTerm = ref(customers.filters.search ?? '');
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

watch(searchTerm, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  searchDebounce = setTimeout(() => {
    customers.setSearch(value);
  }, 300);
});

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
});

function onStatusFilterChange(event: Event): void {
  customers.setStatusFilter((event.target as HTMLSelectElement).value as CustomerStatus | '');
}

function onTypeFilterChange(event: Event): void {
  customers.setTypeFilter((event.target as HTMLSelectElement).value as CustomerType | '');
}

function previousPage(): void {
  if (customers.meta && customers.filters.page > 1) {
    customers.setPage(customers.filters.page - 1);
  }
}

function nextPage(): void {
  if (customers.meta && customers.filters.page < customers.meta.totalPages) {
    customers.setPage(customers.filters.page + 1);
  }
}

onMounted(() => {
  void customers.load();
});
</script>

<template>
  <section>
    <header class="customers__header">
      <h1>Customers</h1>
      <RouterLink v-if="auth.can('customers:write')" to="/customers/new" class="customers__create">
        Create customer
      </RouterLink>
    </header>

    <form class="customers__filters" @submit.prevent>
      <label>
        Search
        <input v-model="searchTerm" type="search" placeholder="Name, company, email or phone">
      </label>

      <label>
        Status
        <select @change="onStatusFilterChange">
          <option value="">All statuses</option>
          <option v-for="status in CUSTOMER_STATUSES" :key="status" :value="status">
            {{ statusLabel(status) }}
          </option>
        </select>
      </label>

      <label>
        Type
        <select @change="onTypeFilterChange">
          <option value="">All types</option>
          <option v-for="type in CUSTOMER_TYPES" :key="type" :value="type">
            {{ typeLabel(type) }}
          </option>
        </select>
      </label>
    </form>

    <p v-if="customers.isLoading && !customers.items.length">Loading customers…</p>

    <div v-else-if="customers.error && !customers.items.length" role="alert" class="customers__error">
      {{ customers.error }}
    </div>

    <p v-else-if="!customers.items.length">No customers match these filters.</p>

    <template v-else>
      <div class="customers__table-wrap">
        <table class="customers__table">
          <caption class="sr-only">Customers</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              <th scope="col">City</th>
              <th scope="col">Status</th>
              <th scope="col">Notes/Files</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="customer in customers.items" :key="customer.id">
              <td>
                <RouterLink :to="`/customers/${customer.id}`">{{ customer.name }}</RouterLink>
              </td>
              <td>{{ typeLabel(customer.type) }}</td>
              <td>{{ customer.email ?? '—' }}</td>
              <td>{{ customer.phone ?? '—' }}</td>
              <td>{{ customer.city ?? '—' }}</td>
              <td>
                <span
                  class="customers__badge"
                  :class="'customers__badge--' + customer.status.toLowerCase()"
                >
                  {{ statusLabel(customer.status) }}
                </span>
              </td>
              <td>{{ customer.counts.notes }} / {{ customer.counts.attachments }}</td>
              <td class="customers__actions">
                <RouterLink :to="`/customers/${customer.id}`">View</RouterLink>
                <RouterLink v-if="auth.can('customers:write')" :to="`/customers/${customer.id}/edit`">
                  Edit
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="customers__pagination">
        <button type="button" :disabled="!customers.meta || customers.meta.page <= 1" @click="previousPage">
          Previous
        </button>
        <span v-if="customers.meta">
          Page {{ customers.meta.page }} of {{ customers.meta.totalPages }} — {{ customers.meta.total }} total
        </span>
        <button
          type="button"
          :disabled="!customers.meta || customers.meta.page >= customers.meta.totalPages"
          @click="nextPage"
        >
          Next
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.customers__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.customers__create {
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: #ffffff;
  text-decoration: none;
  font-size: 0.9rem;
}

.customers__filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.customers__filters label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.customers__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  margin-bottom: 1rem;
}

.customers__table-wrap {
  overflow-x: auto;
}

.customers__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customers__table th,
.customers__table td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.customers__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.customers__pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.customers__badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid var(--color-border);
}

.customers__badge--active {
  background: color-mix(in srgb, var(--color-ok) 12%, white);
  border-color: var(--color-ok);
  color: var(--color-ok);
}

.customers__badge--prospect {
  background: color-mix(in srgb, var(--color-accent) 12%, white);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.customers__badge--inactive {
  background: color-mix(in srgb, var(--color-text-muted) 12%, white);
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.customers__badge--archived {
  background: color-mix(in srgb, var(--color-border) 40%, white);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}
</style>
