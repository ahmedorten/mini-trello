<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

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
    <h1>{{ isEdit ? t('customer.form.editTitle') : t('customer.form.newTitle') }}</h1>

    <form class="customer-form" @submit.prevent="submit">
      <div v-if="customers.error" role="alert" class="customer-form__error">{{ customers.error }}</div>

      <fieldset>
        <legend>{{ t('customer.form.section.identity') }}</legend>
        <label>
          {{ t('customer.field.name') }}
          <input v-model="form.name" type="text" required minlength="2">
        </label>
        <label>
          {{ t('customer.field.type') }}
          <select v-model="form.type">
            <option v-for="type in CUSTOMER_TYPES" :key="type" :value="type">{{ t(`customer.type.${type}`) }}</option>
          </select>
        </label>
        <label>
          {{ t('customer.field.companyName') }}
          <input v-model="form.companyName" type="text">
        </label>
        <label v-if="!isEdit">
          {{ t('customer.field.status') }}
          <select v-model="form.status">
            <option v-for="status in CUSTOMER_STATUSES" :key="status" :value="status">
              {{ t(`customer.status.${status}`) }}
            </option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ t('customer.form.section.contact') }}</legend>
        <label>
          {{ t('customer.field.email') }}
          <input v-model="form.email" type="email">
        </label>
        <label>
          {{ t('customer.field.phone') }}
          <input v-model="form.phone" type="text">
        </label>
        <label>
          {{ t('customer.field.alternatePhone') }}
          <input v-model="form.alternatePhone" type="text">
        </label>
        <label>
          {{ t('customer.field.addressLine1') }}
          <input v-model="form.addressLine1" type="text">
        </label>
        <label>
          {{ t('customer.field.addressLine2') }}
          <input v-model="form.addressLine2" type="text">
        </label>
        <label>
          {{ t('customer.field.city') }}
          <input v-model="form.city" type="text">
        </label>
        <label>
          {{ t('customer.field.country') }}
          <input v-model="form.country" type="text">
        </label>
        <label>
          {{ t('customer.field.postalCode') }}
          <input v-model="form.postalCode" type="text">
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ t('customer.form.section.assignment') }}</legend>
        <label>
          {{ t('customer.field.assignedAgent') }}
          <select v-model="form.assignedAgentId">
            <option value="">{{ t('common.unassigned') }}</option>
            <option v-for="agent in customers.agents" :key="agent.id" :value="agent.id">
              {{ agent.fullName }}
            </option>
          </select>
        </label>
      </fieldset>

      <div class="customer-form__actions">
        <button type="submit" :disabled="customers.isSaving || form.name.trim().length < 2">{{ t('common.save') }}</button>
        <button type="button" @click="cancel">{{ t('common.cancel') }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.customer-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-inline-size: 40rem;
}

.customer-form fieldset {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.customer-form label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.customer-form__error {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.customer-form__actions {
  display: flex;
  gap: var(--space-2);
}
</style>
