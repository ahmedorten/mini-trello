<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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

function categoryLabel(category: TicketCategory): string {
  return category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, ' ');
}

function priorityLabel(priority: TicketPriority): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

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
    <h1>{{ isEdit ? 'Edit ticket' : 'New ticket' }}</h1>

    <form class="ticket-form" @submit.prevent="submit">
      <div v-if="tickets.error" role="alert" class="ticket-form__error">{{ tickets.error }}</div>

      <fieldset>
        <legend>Ticket</legend>
        <label v-if="!isEdit">
          Customer
          <select v-model="form.customerId" required>
            <option value="" disabled>Select a customer</option>
            <option v-for="customer in tickets.customerOptions" :key="customer.id" :value="customer.id">
              {{ customer.name }}
            </option>
          </select>
        </label>
        <p v-else class="ticket-form__static">
          Customer: <strong>{{ tickets.current?.customer.name }}</strong>
        </p>
        <label>
          Subject
          <input v-model="form.subject" type="text" required minlength="2" maxlength="160">
        </label>
        <label>
          Description
          <textarea v-model="form.description" rows="5" required minlength="1" maxlength="8000" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Classification</legend>
        <label>
          Category
          <select v-model="form.category">
            <option v-for="category in TICKET_CATEGORIES" :key="category" :value="category">
              {{ categoryLabel(category) }}
            </option>
          </select>
        </label>
        <label>
          Priority
          <select v-model="form.priority">
            <option v-for="priority in TICKET_PRIORITIES" :key="priority" :value="priority">
              {{ priorityLabel(priority) }}
            </option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Assignment</legend>
        <label>
          Assigned agent
          <select v-model="form.assignedAgentId">
            <option value="">Unassigned</option>
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
          Save
        </button>
        <button type="button" @click="cancel">Cancel</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.ticket-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 640px;
}

.ticket-form fieldset {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ticket-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ticket-form__static {
  margin: 0;
}

.ticket-form__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.ticket-form__actions {
  display: flex;
  gap: 0.5rem;
}
</style>
