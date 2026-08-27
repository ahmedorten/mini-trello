<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useCustomersStore } from '@/stores/customers';
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  type CustomerSortField,
  type CustomerStatus,
  type CustomerType,
} from '@/api/customers';
import AppStateBlock from '@/components/AppStateBlock.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppPagination from '@/components/AppPagination.vue';
import AppIcon from '@/components/AppIcon.vue';
import AppSortHeader from '@/components/AppSortHeader.vue';

const auth = useAuthStore();
const customers = useCustomersStore();
const { t } = useI18n();

const STATUS_TONE: Record<CustomerStatus, 'ok' | 'accent' | 'neutral'> = {
  ACTIVE: 'ok',
  PROSPECT: 'accent',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
};

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

function onPageChange(page: number): void {
  customers.setPage(page);
}

function onPageSizeChange(pageSize: number): void {
  customers.setPageSize(pageSize);
}

// AppSortHeader emits a bare string — the field prop values are typed at each
// call site, but the emit itself cannot carry a per-view union.
function onSort(field: string): void {
  customers.setSort(field as CustomerSortField);
}

onMounted(() => {
  void customers.load();
});
</script>

<template>
  <section>
    <header class="customers__header">
      <h1>{{ t('customer.list.title') }}</h1>
      <RouterLink v-if="auth.can('customers:write')" to="/customers/new" class="customers__create">
        <AppIcon name="plus" :size="16" />
        {{ t('customer.list.createCustomer') }}
      </RouterLink>
    </header>

    <form class="filter-bar" @submit.prevent>
      <label>
        {{ t('common.search') }}
        <input v-model="searchTerm" type="search" :placeholder="t('customer.list.searchPlaceholder')">
      </label>

      <label>
        {{ t('customer.field.status') }}
        <select @change="onStatusFilterChange">
          <option value="">{{ t('customer.list.allStatuses') }}</option>
          <option v-for="status in CUSTOMER_STATUSES" :key="status" :value="status">
            {{ t(`customer.status.${status}`) }}
          </option>
        </select>
      </label>

      <label>
        {{ t('customer.field.type') }}
        <select @change="onTypeFilterChange">
          <option value="">{{ t('customer.list.allTypes') }}</option>
          <option v-for="type in CUSTOMER_TYPES" :key="type" :value="type">
            {{ t(`customer.type.${type}`) }}
          </option>
        </select>
      </label>
    </form>

    <AppStateBlock v-if="customers.isLoading && !customers.items.length" variant="loading" :message="t('customer.list.loading')" />

    <AppStateBlock
      v-else-if="customers.error && !customers.items.length"
      variant="error"
      :message="customers.error"
      class="customers__error"
    />

    <AppStateBlock v-else-if="!customers.items.length" variant="empty" :message="t('customer.list.empty')" />

    <template v-else>
      <div class="data-table-wrap">
        <table class="data-table">
          <caption class="sr-only">{{ t('customer.list.caption') }}</caption>
          <thead>
            <tr>
              <AppSortHeader field="name" :label="t('customer.field.name')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="onSort" />
              <AppSortHeader field="type" :label="t('customer.field.type')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="onSort" />
              <AppSortHeader field="email" :label="t('customer.field.email')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="onSort" />
              <th scope="col">{{ t('customer.field.phone') }}</th>
              <AppSortHeader field="city" :label="t('customer.field.city')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="onSort" />
              <AppSortHeader field="status" :label="t('customer.field.status')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="onSort" />
              <th scope="col">{{ t('customer.field.notesFiles') }}</th>
              <th scope="col">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="customer in customers.items" :key="customer.id">
              <td>
                <RouterLink :to="`/customers/${customer.id}`">{{ customer.name }}</RouterLink>
              </td>
              <td>{{ t(`customer.type.${customer.type}`) }}</td>
              <td><span dir="ltr">{{ customer.email ?? '—' }}</span></td>
              <td><span dir="ltr">{{ customer.phone ?? '—' }}</span></td>
              <td>{{ customer.city ?? '—' }}</td>
              <td>
                <AppBadge :tone="STATUS_TONE[customer.status]">{{ t(`customer.status.${customer.status}`) }}</AppBadge>
              </td>
              <td>{{ customer.counts.notes }} / {{ customer.counts.attachments }}</td>
              <td class="data-table__actions">
                <RouterLink :to="`/customers/${customer.id}`">{{ t('common.view') }}</RouterLink>
                <RouterLink v-if="auth.can('customers:write')" :to="`/customers/${customer.id}/edit`">
                  {{ t('common.edit') }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="customers__pagination">
        <AppPagination
          v-if="customers.meta"
          :page="customers.meta.page"
          :total-pages="customers.meta.totalPages"
          :total="customers.meta.total"
          :page-size="customers.meta.pageSize"
          @change="onPageChange"
          @page-size-change="onPageSizeChange"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.customers__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: var(--space-5);
}

.customers__create {
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

.customers__error {
  margin-block-end: var(--space-4);
}
</style>
