<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import { createTicketInteraction, listTicketInteractions } from '@/api/tickets';
import {
  deleteInteraction,
  INTERACTION_CHANNELS,
  type CustomerInteraction,
  type InteractionChannel,
  type InteractionDirection,
} from '@/api/customers';
import { toErrorMessage } from '@/api/client';
import { toLocalDatetimeInput } from '@/utils/format';
import AppStateBlock from './AppStateBlock.vue';
import AppBadge from './AppBadge.vue';
import AppIcon from './AppIcon.vue';
import AppButton from './AppButton.vue';
import QuickReplyPicker from './QuickReplyPicker.vue';

const props = withDefaults(
  defineProps<{
    ticketId: string;
    customerId: string;
    readonly?: boolean;
    maxItems?: number;
  }>(),
  { readonly: false, maxItems: undefined },
);

const auth = useAuthStore();
const dashboard = useDashboardStore();
const { t, d } = useI18n();

const interactions = ref<CustomerInteraction[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const includeCustomerHistory = ref(false);
const channelFilter = ref<InteractionChannel | ''>('');
const directionFilter = ref<InteractionDirection | ''>('');

let latestRequestId = 0;

async function load(): Promise<void> {
  const requestId = ++latestRequestId;
  isLoading.value = true;
  error.value = null;

  try {
    const result = await listTicketInteractions(props.ticketId, {
      channel: channelFilter.value || undefined,
      direction: directionFilter.value || undefined,
      includeCustomerHistory: includeCustomerHistory.value,
    });

    if (requestId !== latestRequestId) {
      return;
    }

    interactions.value = result;
  } catch (caught) {
    if (requestId !== latestRequestId) {
      return;
    }

    interactions.value = [];
    error.value = toErrorMessage(caught);
  } finally {
    if (requestId === latestRequestId) {
      isLoading.value = false;
    }
  }
}

watch(() => props.ticketId, load);
watch([includeCustomerHistory, channelFilter, directionFilter], load);

onMounted(() => {
  void load();
  void dashboard.loadChannels();
});

const visibleInteractions = computed(() =>
  props.maxItems ? interactions.value.slice(0, props.maxItems) : interactions.value,
);

const respondableChannels = computed(() => dashboard.channels.filter((channel) => channel.canRespond));

const showComposer = computed(() => !props.readonly && auth.can('interactions:write'));

// --- composer ----------------------------------------------------------------

const composerOpen = ref(false);

const composerForm = reactive({
  channel: '' as InteractionChannel | '',
  subject: '',
  body: '',
  occurredAt: toLocalDatetimeInput(new Date()),
});

watch(respondableChannels, (channels) => {
  if (!composerForm.channel && channels.length > 0) {
    composerForm.channel = channels[0].key;
  }
});

function openComposer(): void {
  composerOpen.value = true;

  if (!composerForm.channel && respondableChannels.value.length > 0) {
    composerForm.channel = respondableChannels.value[0].key;
  }
}

function closeComposer(): void {
  composerOpen.value = false;
}

const isSubmitting = ref(false);

async function submitComposer(): Promise<void> {
  if (!composerForm.channel) {
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    // datetime-local yields a local, zoneless string; the API needs a real
    // ISO instant, or an agent east of UTC could trip the future-timestamp
    // check.
    const occurredAtIso = new Date(composerForm.occurredAt).toISOString();

    await createTicketInteraction(props.ticketId, {
      channel: composerForm.channel,
      direction: 'OUTBOUND',
      subject: composerForm.subject,
      body: composerForm.body || undefined,
      occurredAt: occurredAtIso,
    });

    composerForm.subject = '';
    composerForm.body = '';
    composerForm.occurredAt = toLocalDatetimeInput(new Date());
    composerOpen.value = false;
    await load();
  } catch (caught) {
    error.value = toErrorMessage(caught);
  } finally {
    isSubmitting.value = false;
  }
}

// --- delete --------------------------------------------------------------

function canDelete(interaction: CustomerInteraction): boolean {
  return auth.can('interactions:write')
    && (interaction.createdBy?.id === auth.user?.id || auth.can('customers:archive'));
}

async function remove(interaction: CustomerInteraction): Promise<void> {
  if (!window.confirm(t('customer.detail.deleteInteractionConfirm'))) {
    return;
  }

  // There is no ticket-scoped delete route; interactions are deleted through
  // the customer they belong to.
  try {
    await deleteInteraction(interaction.customerId, interaction.id);
    await load();
  } catch (caught) {
    error.value = toErrorMessage(caught);
  }
}

function isOtherTicket(interaction: CustomerInteraction): boolean {
  return interaction.ticket !== null && interaction.ticket.id !== props.ticketId;
}
</script>

<template>
  <div class="communication-timeline">
    <div class="communication-timeline__toolbar">
      <label class="communication-timeline__toggle">
        <input v-model="includeCustomerHistory" type="checkbox">
        {{ t('communication.includeCustomerHistory') }}
      </label>

      <label>
        {{ t('communication.filterChannel') }}
        <select v-model="channelFilter">
          <option value="">{{ t('common.all') }}</option>
          <option v-for="channel in INTERACTION_CHANNELS" :key="channel" :value="channel">
            {{ t(`interaction.channel.${channel}`) }}
          </option>
        </select>
      </label>

      <label>
        {{ t('communication.filterDirection') }}
        <select v-model="directionFilter">
          <option value="">{{ t('common.all') }}</option>
          <option value="INBOUND">{{ t('interaction.direction.INBOUND') }}</option>
          <option value="OUTBOUND">{{ t('interaction.direction.OUTBOUND') }}</option>
        </select>
      </label>

      <AppButton v-if="showComposer && !composerOpen" variant="primary" size="sm" icon="send" @click="openComposer">
        {{ t('communication.respond') }}
      </AppButton>
    </div>

    <form v-if="showComposer && composerOpen" class="communication-timeline__composer" @submit.prevent="submitComposer">
      <AppStateBlock variant="warning" :message="t('communication.noProviderNotice')" />

      <label>
        {{ t('customer.detail.channel') }}
        <select v-model="composerForm.channel" required>
          <option v-for="channel in respondableChannels" :key="channel.key" :value="channel.key">
            {{ t(`interaction.channel.${channel.key}`) }}
          </option>
        </select>
      </label>

      <p class="communication-timeline__direction">
        {{ t('customer.detail.direction') }}: {{ t('interaction.direction.OUTBOUND') }}
      </p>

      <label>
        {{ t('ticket.field.subject') }}
        <input v-model="composerForm.subject" type="text" required minlength="2">
      </label>

      <label>
        {{ t('ticket.field.description') }}
        <textarea v-model="composerForm.body" rows="3" />
      </label>

      <QuickReplyPicker v-model="composerForm.body" :channel="composerForm.channel || undefined" mode="insert" />

      <label>
        {{ t('customer.detail.occurredAt') }}
        <input v-model="composerForm.occurredAt" type="datetime-local" required>
      </label>

      <div class="communication-timeline__composer-actions">
        <AppButton type="submit" variant="primary" size="sm" :loading="isSubmitting">
          {{ t('communication.send') }}
        </AppButton>
        <AppButton type="button" variant="ghost" size="sm" @click="closeComposer">{{ t('common.cancel') }}</AppButton>
      </div>
    </form>

    <AppStateBlock v-if="error" variant="error" :message="error" />

    <AppStateBlock v-else-if="isLoading && !interactions.length" variant="loading" :message="t('common.loading')" />

    <AppStateBlock v-else-if="!interactions.length" variant="empty" :message="t('communication.empty')" />

    <ul v-else class="communication-timeline__list">
      <li
        v-for="interaction in visibleInteractions"
        :key="interaction.id"
        class="communication-timeline__entry"
        :class="{ 'communication-timeline__entry--other': isOtherTicket(interaction) }"
      >
        <div class="communication-timeline__badges">
          <AppBadge tone="info">
            <AppIcon name="communication" :size="14" />
            {{ t(`interaction.channel.${interaction.channel}`) }}
          </AppBadge>
          <AppBadge tone="neutral">{{ t(`interaction.direction.${interaction.direction}`) }}</AppBadge>
          <RouterLink v-if="isOtherTicket(interaction)" :to="`/tickets/${interaction.ticket!.id}`">
            {{ t('communication.otherTicket', { subject: interaction.ticket!.subject }) }}
          </RouterLink>
        </div>

        <p class="communication-timeline__subject">{{ interaction.subject }}</p>
        <p v-if="interaction.body" class="communication-timeline__body">{{ interaction.body }}</p>

        <p class="communication-timeline__meta">
          {{ d(new Date(interaction.occurredAt), 'long') }} —
          {{ t('customer.detail.loggedBy', { name: interaction.createdBy?.fullName ?? t('communication.systemAuthor') }) }}
        </p>

        <AppButton v-if="canDelete(interaction)" variant="ghost" size="sm" @click="remove(interaction)">
          {{ t('common.delete') }}
        </AppButton>
      </li>
    </ul>

    <p v-if="maxItems && interactions.length > maxItems" class="communication-timeline__footer">
      {{ t('common.showingOfTotal', { shown: maxItems, total: interactions.length }) }}
      —
      <RouterLink :to="`/customers/${customerId}`">{{ t('customerSummary.viewProfile') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.communication-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.communication-timeline__toolbar {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.communication-timeline__toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.communication-timeline__composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.communication-timeline__composer-actions {
  display: flex;
  gap: var(--space-2);
}

.communication-timeline__direction {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}

.communication-timeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-inline-start: 2px solid var(--color-border);
}

.communication-timeline__entry {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-inline-start: var(--space-3);
}

.communication-timeline__entry--other {
  background: var(--color-surface-sunken);
}

.communication-timeline__badges {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-block-end: var(--space-2);
}

.communication-timeline__subject {
  margin: 0 0 var(--space-1);
  font-weight: var(--font-weight-medium);
}

.communication-timeline__body {
  white-space: pre-wrap;
  margin: 0 0 var(--space-2);
}

.communication-timeline__meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0 0 var(--space-2);
}

.communication-timeline__footer {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
