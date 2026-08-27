<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useCommunicationStore } from '@/stores/communication';
import type { Conversation } from '@/api/communication';
import {
  INTERACTION_CHANNELS,
  INTERACTION_DELIVERY_STATUSES,
  type InteractionChannel,
  type InteractionDeliveryStatus,
  type InteractionDirection,
} from '@/api/customers';
import { CHANNEL_ICONS } from '@/components/channels';
import AppCard from '@/components/AppCard.vue';
import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import AppPagination from '@/components/AppPagination.vue';
import AppStateBlock from '@/components/AppStateBlock.vue';
import CommunicationTimeline from '@/components/CommunicationTimeline.vue';

const route = useRoute();
const router = useRouter();
const communication = useCommunicationStore();
const { t, d, n } = useI18n();

// --- filters -------------------------------------------------------------

const searchTerm = ref(communication.filters.search);
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

watch(searchTerm, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  searchDebounce = setTimeout(() => {
    communication.setSearch(value);
  }, 300);
});

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
});

function onChannelChange(event: Event): void {
  communication.setChannel((event.target as HTMLSelectElement).value as InteractionChannel | '');
}

function onDirectionChange(event: Event): void {
  communication.setDirection(
    (event.target as HTMLSelectElement).value as InteractionDirection | '',
  );
}

function onDeliveryStatusChange(event: Event): void {
  communication.setDeliveryStatus(
    (event.target as HTMLSelectElement).value as InteractionDeliveryStatus | '',
  );
}

function onMineChange(event: Event): void {
  communication.setMine((event.target as HTMLInputElement).checked);
}

// --- selection ↔ URL -----------------------------------------------------

/** A thread key is derived, opaque, and can be null — three properties that
 *  make a bad path segment. A query parameter still makes the selection
 *  shareable and back-button-able, which is the point. */
function syncUrl(): void {
  const selected = communication.selected;

  // replace, not push: clicking through five conversations must not fill the
  // back stack with five entries.
  void router.replace({
    query: selected
      ? {
          customerId: selected.customerId,
          channel: selected.channel,
          ...(selected.threadKey ? { thread: selected.threadKey } : {}),
        }
      : {},
  });
}

function selectConversation(conversation: Conversation): void {
  communication.select(conversation);
  syncUrl();
}

const selectedCustomer = computed(() => {
  const selected = communication.selected;

  if (!selected) {
    return null;
  }

  return (
    communication.conversations.find(
      (conversation) =>
        conversation.customer.id === selected.customerId
        && conversation.channel === selected.channel
        && conversation.threadKey === selected.threadKey,
    )?.customer ?? null
  );
});

function isSelected(conversation: Conversation): boolean {
  const selected = communication.selected;

  return (
    !!selected
    && selected.customerId === conversation.customer.id
    && selected.channel === conversation.channel
    && selected.threadKey === conversation.threadKey
  );
}

function conversationLabel(conversation: Conversation): string {
  // Every pre-delivery-columns interaction lands in the null-threadKey bucket.
  // Labelling it beats hiding the bulk of a real deployment's history.
  return conversation.threadKey ?? t('communication.earlierHistory');
}

async function refresh(): Promise<void> {
  await communication.refresh();
}

onMounted(() => {
  void communication.loadChannels();

  const customerId = route.query.customerId;
  const channel = route.query.channel;

  if (typeof customerId === 'string' && typeof channel === 'string') {
    const thread = route.query.thread;

    communication.select({
      customerId,
      channel: channel as InteractionChannel,
      threadKey: typeof thread === 'string' ? thread : null,
    });
    // select() already triggers loadTimeline(); only conversations remain.
  }

  void communication.loadConversations();
});
</script>

<template>
  <section class="communication-inbox">
    <header class="communication-inbox__header">
      <h1>{{ t('communication.inbox.title') }}</h1>

      <div class="communication-inbox__header-actions">
        <p v-if="communication.timelineMeta" class="communication-inbox__total">
          {{ t('communication.messageCount', { count: n(communication.timelineMeta.total) }) }}
        </p>
        <AppButton variant="ghost" icon="communication" @click="refresh">
          {{ t('communication.inbox.refresh') }}
        </AppButton>
      </div>
    </header>

    <form class="communication-inbox__filters" @submit.prevent>
      <label>
        {{ t('common.search') }}
        <input v-model="searchTerm" type="search">
      </label>

      <label>
        {{ t('communication.filterChannel') }}
        <select :value="communication.filters.channel" @change="onChannelChange">
          <option value="">{{ t('common.all') }}</option>
          <option v-for="channel in INTERACTION_CHANNELS" :key="channel" :value="channel">
            {{ t(`interaction.channel.${channel}`) }}
          </option>
        </select>
      </label>

      <label>
        {{ t('communication.filterDirection') }}
        <select :value="communication.filters.direction" @change="onDirectionChange">
          <option value="">{{ t('common.all') }}</option>
          <option value="INBOUND">{{ t('interaction.direction.INBOUND') }}</option>
          <option value="OUTBOUND">{{ t('interaction.direction.OUTBOUND') }}</option>
        </select>
      </label>

      <label>
        {{ t('communication.filterDeliveryStatus') }}
        <select :value="communication.filters.deliveryStatus" @change="onDeliveryStatusChange">
          <option value="">{{ t('common.all') }}</option>
          <option v-for="status in INTERACTION_DELIVERY_STATUSES" :key="status" :value="status">
            {{ t(`interaction.delivery.${status}`) }}
          </option>
        </select>
      </label>

      <label class="communication-inbox__toggle">
        <input
          type="checkbox"
          :checked="communication.filters.mine"
          @change="onMineChange"
        >
        {{ t('communication.inbox.mine') }}
      </label>
    </form>

    <div class="communication-inbox__panes">
      <div class="communication-inbox__pane">
        <h2>{{ t('communication.inbox.conversations') }}</h2>

        <AppStateBlock
          v-if="communication.conversationsError"
          variant="error"
          :message="communication.conversationsError"
        />

        <AppStateBlock
          v-else-if="communication.isConversationsLoading && !communication.conversations.length"
          variant="loading"
          :message="t('common.loading')"
        />

        <AppStateBlock
          v-else-if="!communication.conversations.length"
          variant="empty"
          :message="t('communication.inbox.empty')"
        />

        <ul v-else class="communication-inbox__list">
          <li v-for="conversation in communication.conversations" :key="`${conversation.customer.id}:${conversation.channel}:${conversation.threadKey ?? ''}`">
            <AppCard
              class="communication-inbox__card"
              :class="{ 'communication-inbox__card--selected': isSelected(conversation) }"
              :aria-current="isSelected(conversation) ? 'true' : undefined"
              role="button"
              tabindex="0"
              @click="selectConversation(conversation)"
              @keydown.enter="selectConversation(conversation)"
              @keydown.space.prevent="selectConversation(conversation)"
            >
              <p class="communication-inbox__card-channel">
                <AppIcon :name="CHANNEL_ICONS[conversation.channel]" :size="14" />
                {{ t(`interaction.channel.${conversation.channel}`) }}
              </p>
              <p class="communication-inbox__card-customer">{{ conversation.customer.name }}</p>
              <p class="communication-inbox__card-thread">{{ conversationLabel(conversation) }}</p>
              <p class="communication-inbox__card-subject">{{ conversation.lastMessage.subject }}</p>
              <p class="communication-inbox__card-meta">
                {{ t('communication.messageCount', { count: n(conversation.messageCount) }) }} —
                {{ d(new Date(conversation.lastOccurredAt), 'long') }}
              </p>
            </AppCard>
          </li>
        </ul>

        <AppPagination
          v-if="communication.conversationsMeta"
          :page="communication.conversationsMeta.page"
          :total-pages="communication.conversationsMeta.totalPages"
          :total="communication.conversationsMeta.total"
          @change="communication.setPage"
        />
      </div>

      <div class="communication-inbox__pane">
        <h2>{{ t('communication.inbox.thread') }}</h2>

        <AppStateBlock
          v-if="!communication.selected"
          variant="empty"
          :message="t('communication.inbox.selectPrompt')"
        />

        <template v-else>
          <RouterLink
            v-if="selectedCustomer"
            :to="`/customers/${selectedCustomer.id}`"
            class="communication-inbox__customer-link"
          >
            {{ selectedCustomer.name }}
          </RouterLink>

          <AppStateBlock
            v-if="communication.timelineError"
            variant="error"
            :message="communication.timelineError"
          />

          <AppStateBlock
            v-else-if="communication.isTimelineLoading && !communication.interactions.length"
            variant="loading"
            :message="t('common.loading')"
          />

          <CommunicationTimeline
            v-else
            :customer-id="communication.selected.customerId"
            :items="communication.interactions"
            :customer-contact="{ email: selectedCustomer?.email ?? null, phone: null }"
            @sent="refresh"
          />

          <AppPagination
            v-if="communication.timelineMeta"
            :page="communication.timelineMeta.page"
            :total-pages="communication.timelineMeta.totalPages"
            :total="communication.timelineMeta.total"
            @change="communication.setPage"
          />
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.communication-inbox__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.communication-inbox__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.communication-inbox__total {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}

.communication-inbox__filters {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-block: var(--space-4);
}

.communication-inbox__toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

/* Flex wrapping rather than a breakpoint: on a narrow viewport the panes stack,
   with no new token and no media query. */
.communication-inbox__panes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  align-items: flex-start;
}

.communication-inbox__pane {
  flex: 1 1 22rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.communication-inbox__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.communication-inbox__card {
  cursor: pointer;
}

.communication-inbox__card--selected {
  border-color: var(--color-accent);
}

.communication-inbox__card-channel {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0 0 var(--space-1);
}

.communication-inbox__card-customer {
  font-weight: var(--font-weight-medium);
  margin: 0 0 var(--space-1);
}

.communication-inbox__card-thread {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0 0 var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.communication-inbox__card-subject {
  margin: 0 0 var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.communication-inbox__card-meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0;
}

.communication-inbox__customer-link {
  font-weight: var(--font-weight-medium);
}
</style>
