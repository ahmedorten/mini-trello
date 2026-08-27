import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { reactive } from 'vue';
import { createPinia } from 'pinia';
import AgentWorkspaceView from './AgentWorkspaceView.vue';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import { useDashboardStore } from '@/stores/dashboard';
import { useTasksStore } from '@/stores/tasks';
import type { Ticket } from '@/api/tickets';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/tickets', () => ({ useTicketsStore: vi.fn() }));
vi.mock('@/stores/dashboard', () => ({ useDashboardStore: vi.fn() }));
vi.mock('@/stores/tasks', () => ({ useTasksStore: vi.fn() }));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseTicketsStore = vi.mocked(useTicketsStore);
const mockedUseDashboardStore = vi.mocked(useDashboardStore);
const mockedUseTasksStore = vi.mocked(useTasksStore);

const STUBS = {
  CommunicationTimeline: true,
  ReassignControl: true,
  QuickReplyPicker: true,
  CustomerSummaryCard: true,
  TicketTasksPanel: true,
};

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't-1',
    customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
    subject: 'Cannot log in',
    description: 'Details',
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
  const store = reactive({ user: { id: 'u-1' }, can: (p: string) => permissions.includes(p) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);
}

const ticketsFilters = { page: 1, pageSize: 20, search: '', category: '', priority: '', status: '', assignedAgentId: '' };

function mockTickets(overrides: { current?: Ticket | null; error?: string | null } = {}) {
  const store = reactive({
    current: 'current' in overrides ? overrides.current : null,
    comments: [],
    attachments: [],
    history: [],
    error: overrides.error ?? null,
    filters: ticketsFilters,
    loadDetail: vi.fn(async () => {}),
    clearDetail: vi.fn(),
    setStatus: vi.fn(async () => true),
    addComment: vi.fn(async () => true),
    editComment: vi.fn(async () => true),
    removeComment: vi.fn(async () => true),
    uploadFile: vi.fn(async () => true),
    downloadFile: vi.fn(async () => true),
    removeAttachment: vi.fn(async () => true),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTicketsStore.mockReturnValue(store as any);

  return store;
}

function mockDashboard() {
  const store = reactive({
    queueItems: [] as Ticket[],
    queueMeta: null,
    queueFilters: { page: 1, pageSize: 20, search: '', status: '', priority: '', scope: 'workable' },
    isQueueLoading: false,
    queueError: null,
    channels: [],
    loadQueue: vi.fn(async () => {}),
    loadChannels: vi.fn(async () => {}),
    setQueueSearch: vi.fn(),
    setQueueScope: vi.fn(),
    setQueueStatusFilter: vi.fn(),
    setQueuePriorityFilter: vi.fn(),
    setQueuePage: vi.fn(),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseDashboardStore.mockReturnValue(store as any);

  return store;
}

function mockTasks() {
  const store = reactive({ agents: [], clearTicketTasks: vi.fn(), loadForTicket: vi.fn(async () => {}) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTasksStore.mockReturnValue(store as any);

  return store;
}

async function mountView(initialPath = '/workspace') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/workspace', name: 'workspace', component: AgentWorkspaceView },
      { path: '/workspace/:id', name: 'workspace-ticket', component: AgentWorkspaceView },
      { path: '/tickets/:id/edit', name: 'ticket-edit', component: { template: '<div />' } },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
    ],
  });
  router.push(initialPath);
  await router.isReady();

  const wrapper = mount(AgentWorkspaceView, {
    global: { plugins: [router, createPinia()], stubs: STUBS },
  });
  await flushPromises();

  return { wrapper, router };
}

describe('AgentWorkspaceView', () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReset();
    mockedUseTicketsStore.mockReset();
    mockedUseDashboardStore.mockReset();
    mockedUseTasksStore.mockReset();
  });

  it('with no route id, the queue renders and the centre shows the empty-selection state (not a redirect)', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ current: null });
    mockDashboard();
    mockTasks();

    const { wrapper, router } = await mountView('/workspace');

    expect(wrapper.text()).toContain('Select a ticket from the queue to see it here.');
    expect(router.currentRoute.value.name).toBe('workspace');
  });

  it('with an id, loadDetail is called with it', async () => {
    mockAuth(['tickets:read']);
    const ticketsStore = mockTickets({ current: makeTicket() });
    mockDashboard();
    mockTasks();

    await mountView('/workspace/t-1');

    expect(ticketsStore.loadDetail).toHaveBeenCalledWith('t-1');
  });

  it('changing the route id calls loadDetail again', async () => {
    mockAuth(['tickets:read']);
    const ticketsStore = mockTickets({ current: makeTicket() });
    mockDashboard();
    mockTasks();

    const { wrapper, router } = await mountView('/workspace/t-1');
    ticketsStore.loadDetail.mockClear();

    await router.push('/workspace/t-2');
    await flushPromises();

    expect(ticketsStore.loadDetail).toHaveBeenCalledWith('t-2');
    void wrapper;
  });

  it('navigating to /workspace calls clearDetail and clearTicketTasks', async () => {
    mockAuth(['tickets:read']);
    const ticketsStore = mockTickets({ current: makeTicket() });
    mockDashboard();
    const tasksStore = mockTasks();

    const { router } = await mountView('/workspace/t-1');

    await router.push('/workspace');
    await flushPromises();

    expect(ticketsStore.clearDetail).toHaveBeenCalled();
    expect(tasksStore.clearTicketTasks).toHaveBeenCalled();
  });

  it('onUnmounted calls clearDetail and clearTicketTasks', async () => {
    mockAuth(['tickets:read']);
    const ticketsStore = mockTickets({ current: makeTicket() });
    mockDashboard();
    const tasksStore = mockTasks();

    const { wrapper } = await mountView('/workspace/t-1');
    wrapper.unmount();

    expect(ticketsStore.clearDetail).toHaveBeenCalled();
    expect(tasksStore.clearTicketTasks).toHaveBeenCalled();
  });

  it('the queue scope select defaults to workable', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ current: null });
    mockDashboard();
    mockTasks();

    const { wrapper } = await mountView('/workspace');

    const scopeSelect = wrapper.findAll('.workspace__queue-body select')[0];
    expect((scopeSelect.element as HTMLSelectElement).value).toBe('workable');
  });

  it('debounces the queue search', async () => {
    vi.useFakeTimers();
    mockAuth(['tickets:read']);
    mockTickets({ current: null });
    const dashboardStore = mockDashboard();
    mockTasks();

    const { wrapper } = await mountView('/workspace');
    await wrapper.find('.workspace__queue-search').setValue('login');

    vi.advanceTimersByTime(300);
    await Promise.resolve();

    expect(dashboardStore.setQueueSearch).toHaveBeenCalledTimes(1);
    expect(dashboardStore.setQueueSearch).toHaveBeenCalledWith('login');

    vi.useRealTimers();
  });

  it('renders four centre tabs and switches between them', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ current: makeTicket() });
    mockDashboard();
    mockTasks();

    const { wrapper } = await mountView('/workspace/t-1');

    const tabs = wrapper.find('.workspace__tabs').findAll('[role="tab"]');
    expect(tabs.map((t) => t.text())).toEqual(['Internal notes (0)', 'Communication', 'Files (0)', 'History']);

    await tabs[1].trigger('click');
    expect(wrapper.findComponent({ name: 'CommunicationTimeline' }).exists()).toBe(true);
  });

  it('the internal-notes composer is gated on ticket-comments:write', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ current: makeTicket() });
    mockDashboard();
    mockTasks();

    const withoutWrite = await mountView('/workspace/t-1');
    expect(withoutWrite.wrapper.find('textarea').exists()).toBe(false);

    mockedUseAuthStore.mockReset();
    mockAuth(['tickets:read', 'ticket-comments:write']);
    const withWrite = await mountView('/workspace/t-1');
    expect(withWrite.wrapper.find('textarea').exists()).toBe(true);
  });

  it('renders ReassignControl and the context rail', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ current: makeTicket() });
    mockDashboard();
    mockTasks();

    const { wrapper } = await mountView('/workspace/t-1');

    expect(wrapper.findComponent({ name: 'ReassignControl' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'CustomerSummaryCard' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'TicketTasksPanel' }).exists()).toBe(true);
  });

  it('mounting the workspace and changing its queue scope leaves useTicketsStore.filters unchanged (Product rule 7)', async () => {
    mockAuth(['tickets:read']);
    mockTickets({ current: null });
    const dashboardStore = mockDashboard();
    mockTasks();

    await mountView('/workspace');

    dashboardStore.setQueueScope('all');
    await flushPromises();

    expect(ticketsFilters).toEqual({
      page: 1, pageSize: 20, search: '', category: '', priority: '', status: '', assignedAgentId: '',
    });
  });
});
