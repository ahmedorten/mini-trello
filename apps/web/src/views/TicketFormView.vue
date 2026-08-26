<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useTicketsStore } from '@/stores/tickets';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type CreateTicketPayload,
  type TicketCategory,
  type TicketPriority,
  type UpdateTicketPayload,
} from '@/api/tickets';

const route = useRoute();
const router = useRouter();
const tickets = useTicketsStore();
const { t } = useI18n();

const ticketId = computed(() => (route.params.id as string | undefined) ?? null);
const isEdit = computed(() => ticketId.value !== null);

const form = reactive({
  customerId: '',
  subject: '',
  description: '',
  category: 'GENERAL' as TicketCategory,
  priority: 'MEDIUM' as TicketPriority,
  assignedAgentId: '',
});

onMounted(async () => {
  void tickets.loadAgents();
  void tickets.loadCustomerOptions();

  if (ticketId.value) {
    await tickets.loadDetail(ticketId.value);

    const current = tickets.current;

    if (current) {
      form.subject = current.subject;
      form.description = current.description;
      form.category = current.category;
      form.priority = current.priority;
      form.assignedAgentId = current.assignedAgent?.id ?? '';
    }
  }
});

async function submit(): Promise<void> {
  if (isEdit.value && ticketId.value) {
    // `assignedAgentId: null` clears via an explicit null — an absent key
    // would leave the previous assignment in place.
    const payload: UpdateTicketPayload = {
      subject: form.subject,
      description: form.description,
      category: form.category,
      priority: form.priority,
      assignedAgentId: form.assignedAgentId || null,
    };

    const ok = await tickets.update(ticketId.value, payload);

    if (ok) {
      await router.replace({ name: 'ticket-detail', params: { id: ticketId.value } });
    }

    return;
  }

  // An untouched optional field must be absent, not sent as an empty string.
  const payload: CreateTicketPayload = {
    customerId: form.customerId,
    subject: form.subject,
    description: form.description,
    category: form.category,
    priority: form.priority,
    assignedAgentId: form.assignedAgentId || undefined,
  };

  const id = await tickets.create(payload);

  if (id) {
    await router.replace({ name: 'ticket-detail', params: { id } });
  }
}

function cancel(): void {
  router.back();
}
</script>

<template>
  <section>
    <h1>{{ isEdit ? t('ticket.form.editTitle') : t('ticket.form.newTitle') }}</h1>

    <form class="ticket-form" @submit.prevent="submit">
      <div v-if="tickets.error" role="alert" class="ticket-form__error">{{ tickets.error }}</div>

      <fieldset>
        <legend>{{ t('ticket.form.section.ticket') }}</legend>
        <label v-if="!isEdit">
          {{ t('ticket.form.customerLabel') }}
          <select v-model="form.customerId" required>
            <option value="" disabled>{{ t('ticket.form.selectCustomer') }}</option>
            <option v-for="customer in tickets.customerOptions" :key="customer.id" :value="customer.id">
              {{ customer.name }}
            </option>
          </select>
        </label>
        <p v-else class="ticket-form__static">
          {{ t('ticket.form.customerStatic', { name: tickets.current?.customer.name ?? '' }) }}
        </p>
        <label>
          {{ t('ticket.field.subject') }}
          <input v-model="form.subject" type="text" required minlength="2" maxlength="160">
        </label>
        <label>
          {{ t('ticket.field.description') }}
          <textarea v-model="form.description" rows="5" required minlength="1" maxlength="8000" />
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ t('ticket.form.section.classification') }}</legend>
        <label>
          {{ t('ticket.field.category') }}
          <select v-model="form.category">
            <option v-for="category in TICKET_CATEGORIES" :key="category" :value="category">
              {{ t(`ticket.category.${category}`) }}
            </option>
          </select>
        </label>
        <label>
          {{ t('ticket.field.priority') }}
          <select v-model="form.priority">
            <option v-for="priority in TICKET_PRIORITIES" :key="priority" :value="priority">
              {{ t(`ticket.priority.${priority}`) }}
            </option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ t('ticket.form.section.assignment') }}</legend>
        <label>
          {{ t('ticket.field.assignedAgent') }}
          <select v-model="form.assignedAgentId">
            <option value="">{{ t('common.unassigned') }}</option>
            <option v-for="agent in tickets.agents" :key="agent.id" :value="agent.id">
              {{ agent.fullName }}
            </option>
          </select>
        </label>
      </fieldset>

      <div class="ticket-form__actions">
        <button
          type="submit"
          :disabled="tickets.isSaving || form.subject.trim().length < 2 || form.description.trim().length < 1"
        >
          {{ t('common.save') }}
        </button>
        <button type="button" @click="cancel">{{ t('common.cancel') }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.ticket-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-inline-size: 40rem;
}

.ticket-form fieldset {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-form label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.ticket-form__static {
  margin: 0;
}

.ticket-form__error {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.ticket-form__actions {
  display: flex;
  gap: var(--space-2);
}
</style>
