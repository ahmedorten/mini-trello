<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useCommunicationStore } from '@/stores/communication';
import { createTicketInteraction, listTicketInteractions } from '@/api/tickets';
import { listCommunicationTimeline, sendMessage } from '@/api/communication';
import {
  createInteraction,
  deleteInteraction,
  listInteractions,
  INTERACTION_CHANNELS,
  INTERACTION_DELIVERY_STATUSES,
  type CustomerInteraction,
  type InteractionChannel,
  type InteractionDeliveryStatus,
  type InteractionDirection,
} from '@/api/customers';
import { toErrorMessage } from '@/api/client';
import { toLocalDatetimeInput } from '@/utils/format';
import { CHANNEL_ICONS, DELIVERY_TONES } from './channels';
import AppStateBlock from './AppStateBlock.vue';
import AppBadge from './AppBadge.vue';
import AppIcon from './AppIcon.vue';
import AppButton from './AppButton.vue';
import AppConfirmDialog from './AppConfirmDialog.vue';
import QuickReplyPicker from './QuickReplyPicker.vue';

const props = withDefaults(
  defineProps<{
    /** Ticket-scoped source. With customerId absent, the ticket supplies it. */
    ticketId?: string;
    /** Customer-scoped source when ticketId is absent; the compose target always. */
    customerId?: string;
    readonly?: boolean;
    maxItems?: number;
    /** Rows to render instead of loading any. The inbox owns its own paging. */
    items?: CustomerInteraction[];
    /** Pre-fills the composer's address field for email/phone channels. */
    customerContact?: { email: string | null; phone: string | null };
  }>(),
  {
    ticketId: undefined,
    customerId: undefined,
    readonly: false,
    maxItems: undefined,
    items: undefined,
    customerContact: undefined,
  },
);

const emit = defineEmits<{ sent: [] }>();

const auth = useAuthStore();
const communication = useCommunicationStore();
const { t, d, n } = useI18n();

const loadedInteractions = ref<CustomerInteraction[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const includeCustomerHistory = ref(false);
const channelFilter = ref<InteractionChannel | ''>('');
const directionFilter = ref<InteractionDirection | ''>('');
const deliveryStatusFilter = ref<InteractionDeliveryStatus | ''>('');

/** Supplied rows win; otherwise whatever load() fetched. */
const interactions = computed(() => props.items ?? loadedInteractions.value);

/** The toolbar's own filters belong to the two self-loading sources. The inbox
 *  supplies `items` and owns its filters, so they are hidden there. */
const showToolbarFilters = computed(() => props.items === undefined);

/** includeCustomerHistory is ticket-only: the concept does not exist for the
 *  other two sources. */
const showHistoryToggle = computed(() => props.ticketId !== undefined);

function filterParams() {
  return {
    channel: channelFilter.value || undefined,
    direction: directionFilter.value || undefined,
    deliveryStatus: deliveryStatusFilter.value || undefined,
  };
}

let latestRequestId = 0;

async function load(): Promise<void> {
  if (props.items !== undefined) {
    return;
  }

  const requestId = ++latestRequestId;
  isLoading.value = true;
  error.value = null;

  try {
    const result = props.ticketId
      ? await listTicketInteractions(props.ticketId, {
          ...filterParams(),
          includeCustomerHistory: includeCustomerHistory.value,
        })
      : props.customerId
        ? await listInteractions(props.customerId, filterParams())
        : (
            await listCommunicationTimeline({
              ...filterParams(),
              pageSize: props.maxItems ?? 20,
            })
          ).items;

    if (requestId !== latestRequestId) {
      return;
    }

    loadedInteractions.value = result;
  } catch (caught) {
    if (requestId !== latestRequestId) {
      return;
    }

    loadedInteractions.value = [];
    error.value = toErrorMessage(caught);
  } finally {
    if (requestId === latestRequestId) {
      isLoading.value = false;
    }
  }
}

watch(() => props.ticketId, load);
watch(() => props.customerId, load);
watch(() => props.items, load);
watch([includeCustomerHistory, channelFilter, directionFilter, deliveryStatusFilter], load);

onMounted(() => {
  if (import.meta.env.DEV && !props.ticketId && !props.customerId && !props.items) {
    // A silently empty (or unfiltered global) timeline is this component's
    // failure mode. Warn rather than throw: a prop mistake should not take the
    // whole screen down.
    console.warn(
      'CommunicationTimeline: mounted with no ticketId, customerId, or items — ' +
        'it will render an unscoped global feed.',
    );
  }

  void load();
  void communication.loadChannels();
});

const visibleInteractions = computed(() =>
  props.maxItems ? interactions.value.slice(0, props.maxItems) : interactions.value,
);

const respondableChannels = computed(() => communication.respondableChannels);

const showComposer = computed(() => !props.readonly && auth.can('interactions:write'));

/** The customer-scoped list is the one place an entry's customer is not implied
 *  by context, so it names it. */
const showCustomerLink = computed(() => props.items === undefined && !props.ticketId);

// --- composer ----------------------------------------------------------------

const composerOpen = ref(false);

const composerForm = reactive({
  channel: '' as InteractionChannel | '',
  subject: '',
  body: '',
  address: '',
  occurredAt: toLocalDatetimeInput(new Date()),
});

const selectedDescriptor = computed(() =>
  composerForm.channel ? communication.channelDescriptor(composerForm.channel) : undefined,
);

const needsAddress = computed(() => selectedDescriptor.value?.requiresAddress ?? false);
const showSubject = computed(() => selectedDescriptor.value?.supportsSubject ?? true);
/** Falls back to the DTO's global cap so the counter always has a denominator. */
const bodyLimit = computed(() => selectedDescriptor.value?.maxBodyLength ?? 8000);
const canSendThroughChannel = computed(
  () => auth.can('communication:send') && !!props.customerId,
);
const addressMissing = computed(
  () => needsAddress.value && composerForm.address.trim().length === 0,
);

/** Pre-fill from the customer record; the field stays editable. */
watch(
  () => composerForm.channel,
  () => {
    const kind = selectedDescriptor.value?.addressKind;

    if (kind === 'email') {
      composerForm.address = props.customerContact?.email ?? '';
    } else if (kind === 'phone') {
      composerForm.address = props.customerContact?.phone ?? '';
    } else {
      composerForm.address = '';
    }
  },
);

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
  if (!composerForm.channel || addressMissing.value) {
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    // datetime-local yields a local, zoneless string; the API needs a real
    // ISO instant, or an agent east of UTC could trip the future-timestamp
    // check.
    const occurredAtIso = new Date(composerForm.occurredAt).toISOString();

    // The payload the two fallback routes take: exactly what the log routes
    // took before dispatch existed, `direction` included.
    const logged = {
      channel: composerForm.channel,
      direction: 'OUTBOUND' as InteractionDirection,
      subject: composerForm.subject,
      body: composerForm.body || undefined,
      occurredAt: occurredAtIso,
    };

    if (canSendThroughChannel.value) {
      await sendMessage({
        customerId: props.customerId!,
        ticketId: props.ticketId,
        channel: composerForm.channel,
        subject: showSubject.value ? composerForm.subject : undefined,
        body: composerForm.body,
        address: needsAddress.value ? composerForm.address.trim() : undefined,
        occurredAt: occurredAtIso,
      });
    } else if (props.ticketId) {
      // A caller who can log but not send keeps the previous behaviour exactly,
      // payload included.
      await createTicketInteraction(props.ticketId, logged);
    } else if (props.customerId) {
      await createInteraction(props.customerId, logged);
    }

    composerForm.subject = '';
    composerForm.body = '';
    composerForm.occurredAt = toLocalDatetimeInput(new Date());
    composerOpen.value = false;
    await load();
    emit('sent');
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

const pendingDelete = ref<CustomerInteraction | null>(null);

function requestDelete(interaction: CustomerInteraction): void {
  error.value = null;
  pendingDelete.value = interaction;
}

async function confirmDelete(): Promise<void> {
  const interaction = pendingDelete.value;

  if (!interaction) {
    return;
  }

  pendingDelete.value = null;

  // There is no ticket-scoped delete route; interactions are deleted through
  // the customer they belong to.
  try {
    await deleteInteraction(interaction.customerId, interaction.id);
    await load();
    emit('sent');
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
    <div v-if="showToolbarFilters || showComposer" class="communication-timeline__toolbar">
      <label v-if="showHistoryToggle" class="communication-timeline__toggle">
        <input v-model="includeCustomerHistory" type="checkbox">
        {{ t('communication.includeCustomerHistory') }}
      </label>

      <template v-if="showToolbarFilters">
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

        <label>
          {{ t('communication.filterDeliveryStatus') }}
          <select v-model="deliveryStatusFilter">
            <option value="">{{ t('common.all') }}</option>
            <option v-for="status in INTERACTION_DELIVERY_STATUSES" :key="status" :value="status">
              {{ t(`interaction.delivery.${status}`) }}
            </option>
          </select>
        </label>
      </template>

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

      <label v-if="needsAddress">
        {{ t('communication.address') }}
        <input v-model="composerForm.address" type="text" dir="ltr" maxlength="320">
      </label>

      <AppStateBlock
        v-if="addressMissing"
        variant="warning"
        :message="t('communication.addressRequired')"
      />

      <label v-if="showSubject">
        {{ t('ticket.field.subject') }}
        <input v-model="composerForm.subject" type="text" required minlength="2">
      </label>

      <label>
        {{ t('ticket.field.description') }}
        <textarea v-model="composerForm.body" rows="3" :maxlength="bodyLimit" />
      </label>

      <p class="communication-timeline__counter">
        {{ t('communication.bodyCounter', { count: n(composerForm.body.length), limit: n(bodyLimit) }) }}
      </p>

      <QuickReplyPicker v-model="composerForm.body" :channel="composerForm.channel || undefined" mode="insert" />

      <label>
        {{ t('customer.detail.occurredAt') }}
        <input v-model="composerForm.occurredAt" type="datetime-local" required>
      </label>

      <div class="communication-timeline__composer-actions">
        <AppButton
          type="submit"
          variant="primary"
          size="sm"
          :loading="isSubmitting"
          :disabled="addressMissing"
        >
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
            <AppIcon :name="CHANNEL_ICONS[interaction.channel]" :size="14" />
            {{ t(`interaction.channel.${interaction.channel}`) }}
          </AppBadge>
          <AppBadge tone="neutral">{{ t(`interaction.direction.${interaction.direction}`) }}</AppBadge>
          <AppBadge :tone="DELIVERY_TONES[interaction.deliveryStatus]">
            {{ t(`interaction.delivery.${interaction.deliveryStatus}`) }}
          </AppBadge>
          <RouterLink v-if="isOtherTicket(interaction)" :to="`/tickets/${interaction.ticket!.id}`">
            {{ t('communication.otherTicket', { subject: interaction.ticket!.subject }) }}
          </RouterLink>
        </div>

        <p class="communication-timeline__subject">{{ interaction.subject }}</p>
        <p v-if="interaction.body" class="communication-timeline__body">{{ interaction.body }}</p>

        <p v-if="interaction.channelAddress" class="communication-timeline__address" dir="ltr">
          {{ interaction.channelAddress }}
        </p>

        <p v-if="interaction.failureReason" class="communication-timeline__failure">
          {{ t('communication.failureReason', { reason: interaction.failureReason }) }}
        </p>

        <p class="communication-timeline__meta">
          <RouterLink v-if="showCustomerLink" :to="`/customers/${interaction.customerId}`">
            {{ interaction.customer.name }}
          </RouterLink>
          <template v-if="showCustomerLink"> — </template>
          {{ d(new Date(interaction.occurredAt), 'long') }} —
          {{ t('customer.detail.loggedBy', { name: interaction.createdBy?.fullName ?? t('communication.systemAuthor') }) }}
        </p>

        <AppButton v-if="canDelete(interaction)" variant="ghost" size="sm" @click="requestDelete(interaction)">
          {{ t('common.delete') }}
        </AppButton>
      </li>
    </ul>

    <p v-if="maxItems && interactions.length > maxItems && customerId" class="communication-timeline__footer">
      {{ t('common.showingOfTotal', { shown: maxItems, total: interactions.length }) }}
      —
      <RouterLink :to="`/customers/${customerId}`">{{ t('customerSummary.viewProfile') }}</RouterLink>
    </p>

    <AppConfirmDialog
      :open="pendingDelete !== null"
      message-key="customer.detail.deleteInteractionConfirm"
      @update:open="pendingDelete = null"
      @confirm="confirmDelete"
    />
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

.communication-timeline__direction,
.communication-timeline__counter {
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
  flex-wrap: wrap;
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

.communication-timeline__address {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0 0 var(--space-1);
}

.communication-timeline__failure {
  color: var(--color-error);
  font-size: var(--font-size-xs);
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
