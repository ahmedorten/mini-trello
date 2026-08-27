import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDashboardStore } from './dashboard';
import { getAgentDashboard, type AgentDashboard } from '@/api/dashboard';
import { listTickets, type PaginatedTickets, type Ticket } from '@/api/tickets';

vi.mock('@/api/dashboard', async () => {
  const actual = await vi.importActual<typeof import('@/api/dashboard')>('@/api/dashboard');

  return { ...actual, getAgentDashboard: vi.fn() };
});

vi.mock('@/api/tickets', async () => {
  const actual = await vi.importActual<typeof import('@/api/tickets')>('@/api/tickets');

  return { ...actual, listTickets: vi.fn() };
});

const mockedGetAgentDashboard = vi.mocked(getAgentDashboard);
const mockedListTickets = vi.mocked(listTickets);

const sampleDashboard: AgentDashboard = {
  counts: { assigned: 1, open: 1, pending: 0, overdue: 0, unassigned: 0, resolvedLast7Days: 0 },
  byStatus: [],
  byPriority: [],
  byCategory: [],
  focusTickets: [],
  overdueTickets: [],
  unassignedTickets: [],
  tasksDueSoon: [],
  listLimit: 5,
  generatedAt: '2026-08-27T00:00:00.000Z',
};

const sampleTicket: Ticket = {
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
};

const samplePage: PaginatedTickets = {
  items: [sampleTicket],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('load populates dashboard', async () => {
    mockedGetAgentDashboard.mockResolvedValue(sampleDashboard);
    const store = useDashboardStore();

    await store.load();

    expect(store.dashboard).toEqual(sampleDashboard);
    expect(store.error).toBeNull();
  });

  it('the race guard on load discards a slower earlier response', async () => {
    const store = useDashboardStore();
    let resolveFirst: (value: AgentDashboard) => void;
    let resolveSecond: (value: AgentDashboard) => void;

    mockedGetAgentDashboard
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const firstLoad = store.load();
    const secondLoad = store.load();

    const secondResult = { ...sampleDashboard, listLimit: 7 };
    resolveSecond!(secondResult);
    await secondLoad;
    resolveFirst!(sampleDashboard);
    await firstLoad;

    expect(store.dashboard).toEqual(secondResult);
  });

  it('a load failure clears dashboard and sets error', async () => {
    mockedGetAgentDashboard.mockResolvedValueOnce(sampleDashboard);
    const store = useDashboardStore();
    await store.load();
    expect(store.dashboard).not.toBeNull();

    mockedGetAgentDashboard.mockRejectedValueOnce(new Error('network down'));
    await store.load();

    expect(store.dashboard).toBeNull();
    expect(store.error).toBe('network down');
  });

  it('setScope updates scope and reloads', async () => {
    mockedGetAgentDashboard.mockResolvedValue(sampleDashboard);
    const store = useDashboardStore();

    store.setScope('workable');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.scope).toBe('workable');
    expect(mockedGetAgentDashboard).toHaveBeenCalledWith('workable');
  });

  it('loadQueue populates queueItems and queueMeta', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useDashboardStore();

    await store.loadQueue();

    expect(store.queueItems).toEqual([sampleTicket]);
    expect(store.queueMeta).toEqual(samplePage.meta);
  });

  it('loadQueue has its own counter — an in-flight load() resolving does not cancel a loadQueue() result and vice versa', async () => {
    const store = useDashboardStore();

    let resolveDashboard: (value: AgentDashboard) => void;
    mockedGetAgentDashboard.mockImplementationOnce(
      () => new Promise((resolve) => { resolveDashboard = resolve; }),
    );
    mockedListTickets.mockResolvedValueOnce(samplePage);

    const dashboardLoad = store.load();
    await store.loadQueue();

    expect(store.queueItems).toEqual([sampleTicket]);

    resolveDashboard!(sampleDashboard);
    await dashboardLoad;

    expect(store.dashboard).toEqual(sampleDashboard);
    expect(store.queueItems).toEqual([sampleTicket]);
  });

  it('queueParams maps empty-string filters to undefined', () => {
    const store = useDashboardStore();

    const params = store.queueParams();

    expect(params.search).toBeUndefined();
    expect(params.status).toBeUndefined();
    expect(params.priority).toBeUndefined();
    expect(params.scope).toBe('workable');
  });

  it('queueFilters.scope defaults to workable', () => {
    const store = useDashboardStore();

    expect(store.queueFilters.scope).toBe('workable');
  });

  it('every setQueue* resets queueFilters.page to 1, except setQueuePage', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useDashboardStore();

    store.queueFilters.page = 3;
    store.setQueueSearch('login');
    await Promise.resolve();
    expect(store.queueFilters.page).toBe(1);

    store.queueFilters.page = 3;
    store.setQueueScope('all');
    await Promise.resolve();
    expect(store.queueFilters.page).toBe(1);

    store.queueFilters.page = 3;
    store.setQueueStatusFilter('OPEN');
    await Promise.resolve();
    expect(store.queueFilters.page).toBe(1);

    store.queueFilters.page = 3;
    store.setQueuePriorityFilter('HIGH');
    await Promise.resolve();
    expect(store.queueFilters.page).toBe(1);

    store.queueFilters.page = 3;
    store.setQueuePage(2);
    await Promise.resolve();
    expect(store.queueFilters.page).toBe(2);
  });

  it('refresh runs load() and loadQueue() in parallel', async () => {
    mockedGetAgentDashboard.mockResolvedValue(sampleDashboard);
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useDashboardStore();

    await store.refresh();

    expect(store.dashboard).toEqual(sampleDashboard);
    expect(store.queueItems).toEqual([sampleTicket]);
  });
});
