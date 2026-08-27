import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { reactive } from 'vue';
import { createPinia } from 'pinia';
import AgentDashboardView from './AgentDashboardView.vue';
import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import { useTasksStore } from '@/stores/tasks';
import { listTickets } from '@/api/tickets';
import { getAgentDashboard, type AgentDashboard } from '@/api/dashboard';
import { listTasks } from '@/api/tasks';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/dashboard', () => ({ useDashboardStore: vi.fn() }));
vi.mock('@/stores/tasks', () => ({ useTasksStore: vi.fn() }));
vi.mock('@/api/tickets', async () => {
  const actual = await vi.importActual<typeof import('@/api/tickets')>('@/api/tickets');

  return { ...actual, listTickets: vi.fn() };
});
vi.mock('@/api/dashboard', async () => {
  const actual = await vi.importActual<typeof import('@/api/dashboard')>('@/api/dashboard');

  return { ...actual, getAgentDashboard: vi.fn() };
});
vi.mock('@/api/tasks', async () => {
  const actual = await vi.importActual<typeof import('@/api/tasks')>('@/api/tasks');

  return { ...actual, listTasks: vi.fn() };
});

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseDashboardStore = vi.mocked(useDashboardStore);
const mockedUseTasksStore = vi.mocked(useTasksStore);
const mockedListTickets = vi.mocked(listTickets);
const mockedGetAgentDashboard = vi.mocked(getAgentDashboard);
const mockedListTasks = vi.mocked(listTasks);

function makeDashboard(overrides: Partial<AgentDashboard> = {}): AgentDashboard {
  return {
    counts: { assigned: 5, open: 3, pending: 1, overdue: 0, unassigned: 2, resolvedLast7Days: 4 },
    byStatus: [
      { key: 'OPEN', count: 3 },
      { key: 'IN_PROGRESS', count: 0 },
      { key: 'ON_HOLD', count: 1 },
      { key: 'RESOLVED', count: 0 },
      { key: 'CLOSED', count: 0 },
    ],
    byPriority: [
      { key: 'LOW', count: 1 },
      { key: 'MEDIUM', count: 2 },
      { key: 'HIGH', count: 1 },
      { key: 'URGENT', count: 0 },
    ],
    byCategory: [{ key: 'GENERAL', count: 4 }],
    focusTickets: [],
    overdueTickets: [],
    unassignedTickets: [],
    tasksDueSoon: [],
    listLimit: 5,
    generatedAt: '2026-08-27T00:00:00.000Z',
    ...overrides,
  };
}

function mockAuth(permissions: string[]) {
  const store = reactive({
    user: { id: 'u-1', fullName: 'Nour Hassan' },
    can: (p: string) => permissions.includes(p),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);
}

function mockDashboard(overrides: { dashboard?: AgentDashboard | null; isLoading?: boolean; error?: string | null } = {}) {
  const store = reactive({
    dashboard: 'dashboard' in overrides ? overrides.dashboard : makeDashboard(),
    scope: 'mine',
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    load: vi.fn(async () => {}),
    setScope: vi.fn(),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseDashboardStore.mockReturnValue(store as any);

  return store;
}

function mockTasks() {
  const store = reactive({ setStatus: vi.fn(async () => true) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTasksStore.mockReturnValue(store as any);

  return store;
}

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div />' } },
      { path: '/workspace', name: 'workspace', component: { template: '<div />' } },
      { path: '/workspace/:id', name: 'workspace-ticket', component: { template: '<div />' } },
      { path: '/tickets', name: 'tickets', component: { template: '<div />' } },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
    ],
  });
  router.push('/');
  await router.isReady();

  const wrapper = mount(AgentDashboardView, { global: { plugins: [router, createPinia()] } });
  await wrapper.vm.$nextTick();

  return wrapper;
}

describe('AgentDashboardView', () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReset();
    mockedUseDashboardStore.mockReset();
    mockedUseTasksStore.mockReset();
    mockedListTickets.mockReset();
    mockedGetAgentDashboard.mockReset();
    mockedListTasks.mockReset();
  });

  it('renders six stat tiles from counts', async () => {
    mockAuth(['dashboard:read', 'tasks:read']);
    mockDashboard();
    mockTasks();

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('5');
    expect(wrapper.text()).toContain('3');
    expect(wrapper.text()).toContain('1');
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).toContain('4');
  });

  it('overdue gets the error tone when non-zero and the neutral tone at zero', async () => {
    mockAuth(['dashboard:read', 'tasks:read']);
    mockDashboard({ dashboard: makeDashboard({ counts: { ...makeDashboard().counts, overdue: 0 } }) });
    mockTasks();

    const zeroWrapper = await mountView();
    const zeroTile = zeroWrapper.findAll('.stat-tile').find((tile) => tile.text().includes('Overdue'));
    expect(zeroTile!.classes()).toContain('stat-tile--neutral');

    mockedUseDashboardStore.mockReset();
    mockDashboard({ dashboard: makeDashboard({ counts: { ...makeDashboard().counts, overdue: 3 } }) });
    const nonZeroWrapper = await mountView();
    const nonZeroTile = nonZeroWrapper.findAll('.stat-tile').find((tile) => tile.text().includes('Overdue'));
    expect(nonZeroTile!.classes()).toContain('stat-tile--error');
  });

  it('each insight card renders one row per bucket including zero-count buckets, with the count as text', async () => {
    mockAuth(['dashboard:read']);
    mockDashboard();
    mockTasks();

    const wrapper = await mountView();
    const statusRows = wrapper.findAll('.agent-dashboard__bar-row');
    expect(statusRows.length).toBeGreaterThanOrEqual(5 + 4 + 1);

    const zeroRow = statusRows.find((row) => row.text().includes('In progress'));
    expect(zeroRow!.text()).toContain('0');
  });

  it('each empty ticket list renders an empty state', async () => {
    mockAuth(['dashboard:read']);
    mockDashboard();
    mockTasks();

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('No tickets need your attention right now.');
    expect(wrapper.text()).toContain('Nothing overdue.');
    expect(wrapper.text()).toContain('No unassigned tickets.');
  });

  it('the tasks card is absent without tasks:read, and renders an empty state with tasks:read and an empty array', async () => {
    mockAuth(['dashboard:read']);
    mockDashboard();
    mockTasks();

    const withoutWrapper = await mountView();
    expect(withoutWrapper.text()).not.toContain('No tasks due soon.');

    mockedUseAuthStore.mockReset();
    mockedUseDashboardStore.mockReset();
    mockAuth(['dashboard:read', 'tasks:read']);
    mockDashboard();
    const withWrapper = await mountView();
    expect(withWrapper.text()).toContain('No tasks due soon.');
  });

  it('Complete calls setStatus then dashboard.load()', async () => {
    mockAuth(['dashboard:read', 'tasks:read']);
    const dashboardStore = mockDashboard({
      dashboard: makeDashboard({
        tasksDueSoon: [
          { id: 'task-1', title: 'Call back', status: 'OPEN', dueAt: null, remindAt: null, ticketId: null, customerId: null, isOverdue: false },
        ],
      }),
    });
    const tasksStore = mockTasks();

    const wrapper = await mountView();
    await wrapper.find('button.app-button--ghost').trigger('click');
    await wrapper.vm.$nextTick();

    expect(tasksStore.setStatus).toHaveBeenCalledWith('task-1', 'DONE');
    expect(dashboardStore.load).toHaveBeenCalled();
  });

  it('is exclusively loading, error, or content', async () => {
    mockAuth(['dashboard:read']);
    mockDashboard({ dashboard: null, isLoading: true });
    mockTasks();
    const loadingWrapper = await mountView();
    expect(loadingWrapper.text()).toContain('Loading…');

    mockedUseDashboardStore.mockReset();
    mockDashboard({ dashboard: null, error: 'Cannot reach the API.' });
    const errorWrapper = await mountView();
    expect(errorWrapper.text()).toContain('Cannot reach the API.');
  });

  it('the scope select calls setScope', async () => {
    mockAuth(['dashboard:read']);
    const store = mockDashboard();
    mockTasks();

    const wrapper = await mountView();
    await wrapper.find('select').setValue('workable');

    expect(store.setScope).toHaveBeenCalledWith('workable');
  });

  it('calls dashboard.load() on mount and nothing else (Product rule 1: one call renders the whole screen)', async () => {
    mockAuth(['dashboard:read', 'tasks:read']);
    const store = mockDashboard();
    const tasksStore = mockTasks();

    await mountView();

    expect(store.load).toHaveBeenCalledTimes(1);
    expect(tasksStore.setStatus).not.toHaveBeenCalled();
    // The API layer itself is untouched by mounting the view — only the
    // mocked dashboard.load() action ran.
    expect(mockedGetAgentDashboard).not.toHaveBeenCalled();
    expect(mockedListTickets).not.toHaveBeenCalled();
    expect(mockedListTasks).not.toHaveBeenCalled();
  });
});
