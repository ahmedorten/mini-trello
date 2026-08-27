<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import { useTasksStore } from '@/stores/tasks';
import { assignTicket, type Ticket } from '@/api/tickets';
import { toErrorMessage } from '@/api/client';
import AppButton from './AppButton.vue';

const props = defineProps<{ ticket: Ticket }>();

const auth = useAuthStore();
const tickets = useTicketsStore();
const tasks = useTasksStore();
const { t } = useI18n();

const canWrite = computed(() => auth.can('tickets:write'));
const canAssignAny = computed(() => auth.can('tickets:assign'));
const isAssignedToMe = computed(() => props.ticket.assignedAgent?.id === auth.user?.id);

const selectedAgentId = ref(props.ticket.assignedAgent?.id ?? '');
const isSaving = ref(false);
const error = ref<string | null>(null);

onMounted(() => {
  if (canAssignAny.value && tasks.agents.length === 0) {
    void tasks.loadAgents();
  }
});

async function apply(assignedAgentId: string | null): Promise<void> {
  isSaving.value = true;
  error.value = null;

  try {
    await assignTicket(props.ticket.id, assignedAgentId);
    await tickets.loadDetail(props.ticket.id);
  } catch (caught) {
    error.value = toErrorMessage(caught);
  } finally {
    isSaving.value = false;
  }
}

function onSelectChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  selectedAgentId.value = value;
  void apply(value || null);
}

function claim(): void {
  void apply(auth.user?.id ?? null);
}

function release(): void {
  void apply(null);
}

function unassign(): void {
  selectedAgentId.value = '';
  void apply(null);
}
</script>

<template>
  <div v-if="canWrite" class="reassign-control">
    <template v-if="canAssignAny">
      <select
        class="reassign-control__select"
        :value="selectedAgentId"
        :disabled="isSaving"
        :aria-label="t('assign.assignTo')"
        @change="onSelectChange"
      >
        <option value="">{{ t('common.unassigned') }}</option>
        <option v-for="agent in tasks.agents" :key="agent.id" :value="agent.id">
          {{ agent.fullName }}
        </option>
      </select>

      <AppButton
        v-if="ticket.assignedAgent"
        variant="ghost"
        size="sm"
        :disabled="isSaving"
        @click="unassign"
      >
        {{ t('assign.unassign') }}
      </AppButton>
    </template>

    <template v-else>
      <AppButton
        v-if="!isAssignedToMe"
        variant="secondary"
        size="sm"
        :disabled="isSaving"
        @click="claim"
      >
        {{ t('assign.claim') }}
      </AppButton>

      <AppButton
        v-if="isAssignedToMe"
        variant="ghost"
        size="sm"
        :disabled="isSaving"
        @click="release"
      >
        {{ t('assign.release') }}
      </AppButton>
    </template>

    <p v-if="error" role="alert" class="reassign-control__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.reassign-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.reassign-control__select {
  font: inherit;
}

.reassign-control__error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin: 0;
  flex-basis: 100%;
}
</style>
