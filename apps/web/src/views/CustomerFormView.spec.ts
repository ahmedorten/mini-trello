import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { reactive } from 'vue';
import CustomerFormView from './CustomerFormView.vue';
import { useCustomersStore } from '@/stores/customers';
import type { Customer, CreateCustomerPayload, UpdateCustomerPayload } from '@/api/customers';

vi.mock('@/stores/customers', () => ({ useCustomersStore: vi.fn() }));

const mockedUseCustomersStore = vi.mocked(useCustomersStore);

const sampleCustomer: Customer = {
  id: 'c-1',
  type: 'COMPANY',
  name: 'Orten Trading',
  companyName: 'Orten Trading LLC',
  email: 'contact@orten.example',
  phone: '+20 100 000 0000',
  alternatePhone: null,
  addressLine1: null,
  addressLine2: null,
  city: 'Cairo',
  country: 'Egypt',
  postalCode: null,
  status: 'ACTIVE',
  assignedAgent: null,
  createdBy: null,
  counts: { notes: 0, attachments: 0, interactions: 0 },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

function mockCustomers(overrides: {
  current?: Customer | null;
  isSaving?: boolean;
  error?: string | null;
  createImpl?: (payload: CreateCustomerPayload) => Promise<string | null>;
  updateImpl?: (id: string, payload: UpdateCustomerPayload) => Promise<boolean>;
} = {}) {
  const store = reactive({
    current: overrides.current ?? null,
    agents: [],
    isSaving: overrides.isSaving ?? false,
    error: overrides.error ?? null,
    loadAgents: vi.fn(async () => {}),
    loadDetail: vi.fn(async () => {}),
    create: vi.fn<[CreateCustomerPayload], Promise<string | null>>(overrides.createImpl ?? (async () => 'c-1')),
    update: vi.fn<[string, UpdateCustomerPayload], Promise<boolean>>(overrides.updateImpl ?? (async () => true)),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseCustomersStore.mockReturnValue(store as any);

  return store;
}

async function mountView(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/customers/new', name: 'customer-create', component: CustomerFormView },
      { path: '/customers/:id/edit', name: 'customer-edit', component: CustomerFormView },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
    ],
  });

  router.push(initialPath);
  await router.isReady();

  const wrapper = mount(CustomerFormView, { global: { plugins: [router] } });
  await flushPromises();

  return { wrapper, router };
}

describe('CustomerFormView', () => {
  it('starts with empty fields in create mode and does not call loadDetail', async () => {
    const store = mockCustomers();
    const { wrapper } = await mountView('/customers/new');

    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('');
    expect(store.loadDetail).not.toHaveBeenCalled();
  });

  it('loads and pre-fills the fields in edit mode', async () => {
    const store = mockCustomers({ current: sampleCustomer });
    const { wrapper } = await mountView('/customers/c-1/edit');

    expect(store.loadDetail).toHaveBeenCalledWith('c-1');
    const nameInput = wrapper.find('input[type="text"]').element as HTMLInputElement;
    expect(nameInput.value).toBe('Orten Trading');
  });

  it('submits create with empty optional fields absent from the payload', async () => {
    const store = mockCustomers();
    const { wrapper } = await mountView('/customers/new');

    await wrapper.find('input[type="text"]').setValue('New Co');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.create).toHaveBeenCalledTimes(1);
    const payload = store.create.mock.calls[0][0];
    expect(payload.name).toBe('New Co');
    expect(payload.city).toBeUndefined();
  });

  it('submits edit with emptied fields sent as null, not empty string', async () => {
    const store = mockCustomers({ current: sampleCustomer });
    const { wrapper } = await mountView('/customers/c-1/edit');

    const cityInput = wrapper.findAll('input[type="text"]').find((input) =>
      (input.element as HTMLInputElement).value === 'Cairo',
    )!;
    await cityInput.setValue('');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.update).toHaveBeenCalledTimes(1);
    const [, payload] = store.update.mock.calls[0];
    expect(payload.city).toBeNull();
  });

  it('replaces to the customer detail page on a successful create', async () => {
    const store = mockCustomers({ createImpl: async () => 'new-id' });
    const { wrapper, router } = await mountView('/customers/new');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="text"]').setValue('New Co');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.create).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith({ name: 'customer-detail', params: { id: 'new-id' } });
  });

  it('renders error and does not navigate on a failed submit', async () => {
    mockCustomers({ createImpl: async () => null, error: 'Validation failed' });
    const { wrapper, router } = await mountView('/customers/new');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="text"]').setValue('New Co');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toBe('Validation failed');
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('disables submit while isSaving and when the name is under two characters', async () => {
    mockCustomers({ isSaving: true });
    const { wrapper } = await mountView('/customers/new');

    await wrapper.find('input[type="text"]').setValue('A');
    const submitButton = wrapper.find('button[type="submit"]');

    expect(submitButton.attributes('disabled')).toBeDefined();
  });
});
