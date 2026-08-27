<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getCustomer, type Customer } from '@/api/customers';
import AppCard from './AppCard.vue';
import AppBadge from './AppBadge.vue';
import AppStateBlock from './AppStateBlock.vue';
import CommunicationTimeline from './CommunicationTimeline.vue';

const props = withDefaults(
  defineProps<{
    customerId: string;
    /** When set, the recent-activity strip embeds the read-only
     *  CommunicationTimeline for the ticket the caller is viewing
     *  (Product rule 8). Omitted contexts simply skip the strip. */
    ticketId?: string;
  }>(),
  { ticketId: undefined },
);

const { t } = useI18n();

const customer = ref<Customer | null>(null);
const isLoading = ref(false);
const isForbidden = ref(false);

async function load(): Promise<void> {
  isLoading.value = true;
  isForbidden.value = false;

  try {
    customer.value = await getCustomer(props.customerId);
  } catch {
    // A caller without customers:read gets a "no access" empty state, not a
    // broken card.
    customer.value = null;
    isForbidden.value = true;
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppCard :title="t('customerSummary.title')">
    <AppStateBlock v-if="isLoading && !customer" variant="loading" :message="t('common.loading')" />

    <AppStateBlock v-else-if="isForbidden" variant="empty" :message="t('customerSummary.noAccess')" />

    <div v-else-if="customer" class="customer-summary">
      <h3 class="customer-summary__name">{{ customer.name }}</h3>

      <dl class="customer-summary__fields">
        <div>
          <dt>{{ t('customer.field.type') }}</dt>
          <dd>{{ t(`customer.type.${customer.type}`) }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.status') }}</dt>
          <dd><AppBadge tone="neutral">{{ t(`customer.status.${customer.status}`) }}</AppBadge></dd>
        </div>
        <div>
          <dt>{{ t('customer.field.email') }}</dt>
          <dd><span dir="ltr">{{ customer.email ?? '—' }}</span></dd>
        </div>
        <div>
          <dt>{{ t('customer.field.phone') }}</dt>
          <dd><span dir="ltr">{{ customer.phone ?? '—' }}</span></dd>
        </div>
        <div>
          <dt>{{ t('customer.field.city') }}</dt>
          <dd>{{ customer.city ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.field.assignedAgent') }}</dt>
          <dd>{{ customer.assignedAgent?.fullName ?? t('common.unassigned') }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.tab.notes') }}</dt>
          <dd>{{ customer.counts.notes }}</dd>
        </div>
        <div>
          <dt>{{ t('customer.tab.attachments') }}</dt>
          <dd>{{ customer.counts.attachments }}</dd>
        </div>
        <div>
          <dt>{{ t('nav.workspace') }}</dt>
          <dd>{{ customer.counts.interactions }}</dd>
        </div>
      </dl>

      <RouterLink :to="`/customers/${customer.id}`" class="customer-summary__link">
        {{ t('customerSummary.viewProfile') }}
      </RouterLink>

      <CommunicationTimeline
        v-if="ticketId"
        :ticket-id="ticketId"
        :customer-id="customer.id"
        readonly
        :max-items="3"
      />
    </div>
  </AppCard>
</template>

<style scoped>
.customer-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.customer-summary__name {
  margin: 0;
  font-size: var(--font-size-md);
}

.customer-summary__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin: 0;
}

.customer-summary__fields dt {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.customer-summary__fields dd {
  margin: 0;
  font-size: var(--font-size-sm);
}

.customer-summary__link {
  font-size: var(--font-size-sm);
}
</style>
