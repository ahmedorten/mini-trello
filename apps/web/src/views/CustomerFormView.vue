<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCustomersStore } from '@/stores/customers';
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  type CreateCustomerPayload,
  type CustomerStatus,
  type CustomerType,
  type UpdateCustomerPayload,
} from '@/api/customers';

const route = useRoute();
const router = useRouter();
const customers = useCustomersStore();

const customerId = computed(() => (route.params.id as string | undefined) ?? null);
const isEdit = computed(() => customerId.value !== null);

const form = reactive({
  type: 'INDIVIDUAL' as CustomerType,
  name: '',
  companyName: '',
  email: '',
  phone: '',
  alternatePhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  country: '',
  postalCode: '',
  assignedAgentId: '',
  status: 'PROSPECT' as CustomerStatus,
});

function statusLabel(status: CustomerStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function typeLabel(type: CustomerType): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

onMounted(async () => {
  void customers.loadAgents();

  if (customerId.value) {
    await customers.loadDetail(customerId.value);

    const current = customers.current;

    if (current) {
      form.type = current.type;
      form.name = current.name;
      form.companyName = current.companyName ?? '';
      form.email = current.email ?? '';
      form.phone = current.phone ?? '';
      form.alternatePhone = current.alternatePhone ?? '';
      form.addressLine1 = current.addressLine1 ?? '';
      form.addressLine2 = current.addressLine2 ?? '';
      form.city = current.city ?? '';
      form.country = current.country ?? '';
      form.postalCode = current.postalCode ?? '';
      form.assignedAgentId = current.assignedAgent?.id ?? '';
    }
  }
});

async function submit(): Promise<void> {
  if (isEdit.value && customerId.value) {
    // Cleared fields must send `null` so the API actually clears them; an
    // absent key would leave the previous value in place.
    const payload: UpdateCustomerPayload = {
      type: form.type,
      name: form.name,
      companyName: form.companyName || null,
      email: form.email || null,
      phone: form.phone || null,
      alternatePhone: form.alternatePhone || null,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      country: form.country || null,
      postalCode: form.postalCode || null,
      assignedAgentId: form.assignedAgentId || null,
    };

    const ok = await customers.update(customerId.value, payload);

    if (ok) {
      await router.replace({ name: 'customer-detail', params: { id: customerId.value } });
    }

    return;
  }

  // An untouched optional field must be absent, not sent as an empty string.
  const payload: CreateCustomerPayload = {
    type: form.type,
    name: form.name,
    companyName: form.companyName || undefined,
    email: form.email || undefined,
    phone: form.phone || undefined,
    alternatePhone: form.alternatePhone || undefined,
    addressLine1: form.addressLine1 || undefined,
    addressLine2: form.addressLine2 || undefined,
    city: form.city || undefined,
    country: form.country || undefined,
    postalCode: form.postalCode || undefined,
    assignedAgentId: form.assignedAgentId || undefined,
    status: form.status,
  };

  const id = await customers.create(payload);

  if (id) {
    await router.replace({ name: 'customer-detail', params: { id } });
  }
}

function cancel(): void {
  router.back();
}
</script>

<template>
  <section>
    <h1>{{ isEdit ? 'Edit customer' : 'New customer' }}</h1>

    <form class="customer-form" @submit.prevent="submit">
      <div v-if="customers.error" role="alert" class="customer-form__error">{{ customers.error }}</div>

      <fieldset>
        <legend>Identity</legend>
        <label>
          Name
          <input v-model="form.name" type="text" required minlength="2">
        </label>
        <label>
          Type
          <select v-model="form.type">
            <option v-for="type in CUSTOMER_TYPES" :key="type" :value="type">{{ typeLabel(type) }}</option>
          </select>
        </label>
        <label>
          Company name
          <input v-model="form.companyName" type="text">
        </label>
        <label v-if="!isEdit">
          Status
          <select v-model="form.status">
            <option v-for="status in CUSTOMER_STATUSES" :key="status" :value="status">
              {{ statusLabel(status) }}
            </option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Contact</legend>
        <label>
          Email
          <input v-model="form.email" type="email">
        </label>
        <label>
          Phone
          <input v-model="form.phone" type="text">
        </label>
        <label>
          Alternate phone
          <input v-model="form.alternatePhone" type="text">
        </label>
        <label>
          Address line 1
          <input v-model="form.addressLine1" type="text">
        </label>
        <label>
          Address line 2
          <input v-model="form.addressLine2" type="text">
        </label>
        <label>
          City
          <input v-model="form.city" type="text">
        </label>
        <label>
          Country
          <input v-model="form.country" type="text">
        </label>
        <label>
          Postal code
          <input v-model="form.postalCode" type="text">
        </label>
      </fieldset>

      <fieldset>
        <legend>Assignment</legend>
        <label>
          Assigned agent
          <select v-model="form.assignedAgentId">
            <option value="">Unassigned</option>
            <option v-for="agent in customers.agents" :key="agent.id" :value="agent.id">
              {{ agent.fullName }}
            </option>
          </select>
        </label>
      </fieldset>

      <div class="customer-form__actions">
        <button type="submit" :disabled="customers.isSaving || form.name.trim().length < 2">Save</button>
        <button type="button" @click="cancel">Cancel</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.customer-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 640px;
}

.customer-form fieldset {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customer-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.customer-form__error {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.customer-form__actions {
  display: flex;
  gap: 0.5rem;
}
</style>
