import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTasksStore } from './tasks';
import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateTask,
  type AgentTask,
  type PaginatedAgentTasks,
} from '@/api/tasks';
import { listAgents, type UserSummary } from '@/api/users';

vi.mock('@/api/tasks', async () => {
  const actual = await vi.importActual<typeof import('@/api/tasks')>('@/api/tasks');

  return {
    ...actual,
    listTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    setTaskStatus: vi.fn(),
    deleteTask: vi.fn(),
  };
});

vi.mock('@/api/users', () => ({
  listAgents: vi.fn(),
}));

const mockedListTasks = vi.mocked(listTasks);
const mockedCreateTask = vi.mocked(createTask);
const mockedUpdateTask = vi.mocked(updateTask);
const mockedSetTaskStatus = vi.mocked(setTaskStatus);
const mockedDeleteTask = vi.mocked(deleteTask);
const mockedListAgents = vi.mocked(listAgents);

const sampleTask: AgentTask = {
  id: 'task-1',
  title: 'Call back re: refund status',
  notes: null,
  status: 'OPEN',
  dueAt: null,
  remindAt: null,
  completedAt: null,
  assignee: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  createdBy: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  ticket: { id: 't-1', subject: 'Cannot log in' },
  customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
  isOverdue: false,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const samplePage: PaginatedAgentTasks = {
  items: [sampleTask],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

const sampleAgent: UserSummary = {
  id: 'u-1',
  email: 'agent@crm.local',
  fullName: 'Nour Hassan',
  isActive: true,
  mustChangePassword: false,
  department: null,
  branch: null,
  roles: ['support-agent'],
  lastLoginAt: null,
  createdAt: '2026-08-25T00:00:00.000Z',
};

describe('useTasksStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('load populates items and meta with its own race guard', async () => {
    const store = useTasksStore();
    let resolveFirst: (value: PaginatedAgentTasks) => void;
    let resolveSecond: (value: PaginatedAgentTasks) => void;

    mockedListTasks
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const firstLoad = store.load();
    const secondLoad = store.load();

    const secondPage: PaginatedAgentTasks = {
      items: [{ ...sampleTask, id: 'task-2' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    resolveSecond!(secondPage);
    await secondLoad;
    resolveFirst!(samplePage);
    await firstLoad;

    expect(store.items).toEqual(secondPage.items);
  });

  it('loadForTicket writes only ticketTasks and leaves items untouched', async () => {
    mockedListTasks.mockResolvedValueOnce(samplePage);
    const store = useTasksStore();

    await store.load();
    expect(store.items).toEqual([sampleTask]);

    mockedListTasks.mockResolvedValueOnce({ items: [{ ...sampleTask, id: 'task-3' }], meta: samplePage.meta });
    await store.loadForTicket('t-1');

    expect(store.ticketTasks).toEqual([{ ...sampleTask, id: 'task-3' }]);
    expect(store.items).toEqual([sampleTask]);
  });

  it('loadForTicket swallows a rejection into an empty array without setting error', async () => {
    mockedListTasks.mockRejectedValue(new Error('forbidden'));
    const store = useTasksStore();

    await store.loadForTicket('t-1');

    expect(store.ticketTasks).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('loadAgents swallows a rejection into an empty array', async () => {
    mockedListAgents.mockRejectedValue(new Error('forbidden'));
    const store = useTasksStore();

    await store.loadAgents();

    expect(store.agents).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('loadAgents populates agents on success', async () => {
    mockedListAgents.mockResolvedValue([sampleAgent]);
    const store = useTasksStore();

    await store.loadAgents();

    expect(store.agents).toEqual([sampleAgent]);
  });

  it('create, update, setStatus, and remove return contracts and never throw', async () => {
    mockedListTasks.mockResolvedValue(samplePage);
    const store = useTasksStore();

    mockedCreateTask.mockResolvedValueOnce(sampleTask);
    expect(await store.create({ title: 'Call back' })).toBe(true);

    mockedCreateTask.mockRejectedValueOnce(new Error('validation failed'));
    expect(await store.create({ title: 'x' })).toBe(false);
    expect(store.error).toBe('validation failed');

    mockedUpdateTask.mockResolvedValueOnce(sampleTask);
    expect(await store.update('task-1', { title: 'Updated' })).toBe(true);

    mockedUpdateTask.mockRejectedValueOnce(new Error('boom'));
    expect(await store.update('task-1', { title: 'x' })).toBe(false);

    mockedSetTaskStatus.mockResolvedValueOnce(sampleTask);
    expect(await store.setStatus('task-1', 'DONE')).toBe(true);

    mockedSetTaskStatus.mockRejectedValueOnce(new Error('boom'));
    expect(await store.setStatus('task-1', 'DONE')).toBe(false);

    mockedDeleteTask.mockResolvedValueOnce(undefined);
    expect(await store.remove('task-1')).toBe(true);

    mockedDeleteTask.mockRejectedValueOnce(new Error('boom'));
    expect(await store.remove('task-1')).toBe(false);
  });

  it('a mutation from the ticket panel refreshes ticketTasks and not items', async () => {
    mockedListTasks.mockResolvedValue(samplePage);
    const store = useTasksStore();
    await store.load();
    mockedListTasks.mockClear();

    mockedUpdateTask.mockResolvedValueOnce(sampleTask);
    mockedListTasks.mockResolvedValueOnce({ items: [sampleTask], meta: samplePage.meta });

    await store.update('task-1', { title: 'Updated' }, true, 't-1');

    expect(mockedListTasks).toHaveBeenCalledTimes(1);
    expect(mockedListTasks).toHaveBeenCalledWith({ ticketId: 't-1', pageSize: 100 });
    expect(store.ticketTasks).toEqual([sampleTask]);
  });

  it('clearTicketTasks empties ticketTasks', async () => {
    mockedListTasks.mockResolvedValue(samplePage);
    const store = useTasksStore();
    await store.loadForTicket('t-1');
    expect(store.ticketTasks).toHaveLength(1);

    store.clearTicketTasks();

    expect(store.ticketTasks).toEqual([]);
  });
});
