import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { reactive } from 'vue';
import TicketsView from './TicketsView.vue';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import type { Ticket } from '@/api/tickets';
import type { PaginationMeta } from '@/api/users';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/tickets', () => ({ useTicketsStore: vi.fn() }));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseTicketsStore = vi.mocked(useTicketsStore);

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't-1',
    customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
    subject: 'Cannot log in',
    description: 'After password reset, login fails.',
    category: 'GENERAL',
    priority: 'MEDIUM',
    status: 'OPEN',
    assignedAgent: null,
    createdBy: null,
    counts: { comments: 0, attachments: 0, history: 0 },
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

function mockTickets(overrides: {
  items?: Ticket[];
  meta?: PaginationMeta | null;
  error?: string | null;
  isLoading?: boolean;
} = {}) {
  const store = reactive({
    items: overrides.items ?? [],
    meta: overrides.meta ?? null,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    filters: {
      page: 1, pageSize: 20, search: '', category: '', priority: '', status: '', assignedAgentId: '',
    },
    load: vi.fn(async () => {}),
    setSearch: vi.fn(),
    setCategoryFilter: vi.fn(),
    setPriorityFilter: vi.fn(),
    setStatusFilter: vi.fn(),
    setAssignedAgentFilter: vi.fn(),
    setPage: vi.fn(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTicketsStore.mockReturnValue(store as any);

  return store;
}

async function mountWithRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/tickets', name: 'tickets', component: { template: '<div />' } },
      { path: '/tickets/new', name: 'ticket-create', component: { template: '<div />' } },
      { path: '/tickets/:id', name: 'ticket-detail', component: { template: '<div />' } },
      { path: '/tickets/:id/edit', name: 'ticket-edit', component: { template: '<div />' } },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
    ],
  });
  router.push('/tickets');
  await router.isReady();

  return mount(TicketsView, { global: { plugins: [router] } });
}

describe('TicketsView', () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReset();
    mockedUseTicketsStore.mockReset();
  });

  it('renders one table row per item, showing subject, customer, and sentence-case badges', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ items: [makeTicket()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    const row = wrapper.find('tbody tr');

    expect(row.text()).toContain('Cannot log in');
    expect(row.text()).toContain('Orten Trading');
    expect(row.text()).toContain('Medium');
    expect(row.text()).not.toContain('MEDIUM');
  });

  it('renders the loading state exclusively', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ isLoading: true, items: [] });

    const wrapper = await mountWithRouter();

    expect(wrapper.text()).toContain('Loading tickets…');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders role=alert and no table when the store has an error', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ items: [], error: 'Cannot reach the API.' });

    const wrapper = await mountWithRouter();

    expect(wrapper.find('[role="alert"]').text()).toBe('Cannot reach the API.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders the empty state when there are no items and no error', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ items: [] });

    const wrapper = await mountWithRouter();

    expect(wrapper.text()).toContain('No tickets match these filters.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('shows New ticket only with tickets:write', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ items: [makeTicket()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapperWithout = await mountWithRouter();
    expect(wrapperWithout.text()).not.toContain('New ticket');

    mockedUseAuthStore.mockReset();
    mockAuth(['tickets:read', 'tickets:write']);
    const wrapperWith = await mountWithRouter();
    expect(wrapperWith.text()).toContain('New ticket');
  });

  it('disables Previous on page 1 and Next on the last page', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ items: [makeTicket()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    const buttons = wrapper.findAll('.tickets__pagination button');

    expect(buttons[0].text()).toBe('Previous');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].text()).toBe('Next');
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('changing each filter calls the matching store setter', async () => {
    mockAuth(['tickets:read']);
    const store = mockTickets({
      items: [makeTicket()],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    const wrapper = await mountWithRouter();
    const selects = wrapper.findAll('.tickets__filters select');

    await selects[0].setValue('TECHNICAL');
    expect(store.setCategoryFilter).toHaveBeenCalledWith('TECHNICAL');

    await selects[1].setValue('HIGH');
    expect(store.setPriorityFilter).toHaveBeenCalledWith('HIGH');

    await selects[2].setValue('IN_PROGRESS');
    expect(store.setStatusFilter).toHaveBeenCalledWith('IN_PROGRESS');
  });

  it('typing in the search box calls setSearch once after the debounce', async () => {
    vi.useFakeTimers();
    mockAuth(['tickets:read']);
    const store = mockTickets({ items: [makeTicket()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    await wrapper.find('.tickets__filters input[type="search"]').setValue('login');

    vi.advanceTimersByTime(300);
    await Promise.resolve();

    expect(store.setSearch).toHaveBeenCalledTimes(1);
    expect(store.setSearch).toHaveBeenCalledWith('login');

    vi.useRealTimers();
  });

  it('the subject cell links to the ticket detail page', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ items: [makeTicket()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountWithRouter();
    const subjectLink = wrapper.find('tbody tr a');

    expect(subjectLink.attributes('href')).toBe('/tickets/t-1');
  });
});
