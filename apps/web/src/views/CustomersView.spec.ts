import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { reactive } from 'vue';
import { createPinia } from 'pinia';
import CustomersView from './CustomersView.vue';
import { useAuthStore } from '@/stores/auth';
import { useCustomersStore } from '@/stores/customers';
import type { Customer } from '@/api/customers';
import type { PaginationMeta } from '@/api/users';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/customers', () => ({ useCustomersStore: vi.fn() }));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseCustomersStore = vi.mocked(useCustomersStore);

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
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
    ...overrides,
  };
}

function mockAuth(permissions: string[]) {
  const store = reactive({ can: (permission: string) => permissions.includes(permission) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);

  return store;
}

function mockCustomers(overrides: {
  items?: Customer[];
  meta?: PaginationMeta | null;
  error?: string | null;
  isLoading?: boolean;
} = {}) {
  const store = reactive({
    items: overrides.items ?? [],
    meta: overrides.meta ?? null,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    filters: { page: 1, pageSize: 20, search: '', status: '', type: '', city: '', sort: '', order: 'asc' },
    load: vi.fn(async () => {}),
    setSearch: vi.fn(),
    setStatusFilter: vi.fn(),
    setTypeFilter: vi.fn(),
    setPage: vi.fn(),
    setSort: vi.fn(),
    setPageSize: vi.fn(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseCustomersStore.mockReturnValue(store as any);

  return store;
}

async function mountWithRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/customers', name: 'customers', component: { template: '<div />' } },
      { path: '/customers/new', name: 'customer-create', component: { template: '<div />' } },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
      { path: '/customers/:id/edit', name: 'customer-edit', component: { template: '<div />' } },
    ],
  });
  router.push('/customers');
  await router.isReady();

  return mount(CustomersView, { global: { plugins: [router, createPinia()] } });
}

describe('CustomersView', () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReset();
    mockedUseCustomersStore.mockReset();
  });

  it('renders one table row per item, showing name, email, and sentence-case status', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ items: [makeCustomer()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    const row = wrapper.find('tbody tr');

    expect(row.text()).toContain('Orten Trading');
    expect(row.text()).toContain('contact@orten.example');
    expect(row.text()).toContain('Active');
    expect(row.text()).not.toContain('ACTIVE');
  });

  it('renders the loading state exclusively', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ isLoading: true, items: [] });

    const wrapper = await mountWithRouter();

    expect(wrapper.text()).toContain('Loading customers…');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders role=alert and no table when the store has an error', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ items: [], error: 'Cannot reach the API.' });

    const wrapper = await mountWithRouter();

    expect(wrapper.find('[role="alert"]').text()).toBe('Cannot reach the API.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders the empty state when there are no items and no error', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ items: [] });

    const wrapper = await mountWithRouter();

    expect(wrapper.text()).toContain('No customers match these filters.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('shows Create customer only with customers:write', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ items: [makeCustomer()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapperWithout = await mountWithRouter();
    expect(wrapperWithout.text()).not.toContain('Create customer');

    mockedUseAuthStore.mockReset();
    mockAuth(['customers:read', 'customers:write']);
    const wrapperWith = await mountWithRouter();
    expect(wrapperWith.text()).toContain('Create customer');
  });

  it('disables Previous on page 1 and Next on the last page', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ items: [makeCustomer()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    const buttons = wrapper.findAll('.customers__pagination button');

    expect(buttons[0].text()).toBe('Previous');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].text()).toBe('Next');
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('changing the status filter calls the store setter', async () => {
    mockAuth(['customers:read']);
    const store = mockCustomers({
      items: [makeCustomer()],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    const wrapper = await mountWithRouter();
    const selects = wrapper.findAll('.filter-bar select');
    await selects[0].setValue('ACTIVE');

    expect(store.setStatusFilter).toHaveBeenCalledWith('ACTIVE');
  });

  it('typing in the search box calls setSearch once after the debounce', async () => {
    vi.useFakeTimers();
    mockAuth(['customers:read']);
    const store = mockCustomers({ items: [makeCustomer()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    await wrapper.find('.filter-bar input[type="search"]').setValue('orten');

    vi.advanceTimersByTime(300);
    await Promise.resolve();

    expect(store.setSearch).toHaveBeenCalledTimes(1);
    expect(store.setSearch).toHaveBeenCalledWith('orten');

    vi.useRealTimers();
  });

  it('the name cell links to the customer detail page', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ items: [makeCustomer()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    const nameLink = wrapper.find('tbody tr a');

    expect(nameLink.attributes('href')).toBe('/customers/c-1');
  });

  it('renders a sortable header for each API-sortable column and a plain th for the rest', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ items: [makeCustomer()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    const sortableHeaders = wrapper.findAll('th[aria-sort]');
    const plainHeaders = wrapper.findAll('th:not([aria-sort])');

    expect(sortableHeaders).toHaveLength(5);
    expect(plainHeaders.map((h) => h.text())).toEqual(
      expect.arrayContaining(['Phone', 'Notes/Files', 'Actions']),
    );
  });

  it('calls store.setSort with the API field name when a header button is clicked', async () => {
    mockAuth(['customers:read']);
    const store = mockCustomers({ items: [makeCustomer()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    await wrapper.find('th[aria-sort] button').trigger('click');

    expect(store.setSort).toHaveBeenCalledWith('name');
  });

  it('calls store.setPageSize when the page-size select changes', async () => {
    mockAuth(['customers:read']);
    const store = mockCustomers({
      items: [makeCustomer()],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    const wrapper = await mountWithRouter();
    await wrapper.find('.app-pagination__page-size select').setValue('50');

    expect(store.setPageSize).toHaveBeenCalledWith(50);
  });
});
