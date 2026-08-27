import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TicketTasksPanel from './TicketTasksPanel.vue';
import { useAuthStore } from '@/stores/auth';
import { useTasksStore } from '@/stores/tasks';
import type { AgentTask } from '@/api/tasks';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/tasks', () => ({ useTasksStore: vi.fn() }));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseTasksStore = vi.mocked(useTasksStore);

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
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
    ...overrides,
  };
}

function mockAuth(permissions: string[]) {
  const store = reactive({ can: (p: string) => permissions.includes(p) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);
}

function mockTasks(ticketTasks: AgentTask[] = []) {
  const store = reactive({
    ticketTasks,
    agents: [],
    error: null,
    isSaving: false,
    loadForTicket: vi.fn(async () => {}),
    loadAgents: vi.fn(async () => {}),
    setStatus: vi.fn(async () => true),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTasksStore.mockReturnValue(store as any);

  return store;
}

describe('TicketTasksPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedUseAuthStore.mockReset();
    mockedUseTasksStore.mockReset();
  });

  it('renders nothing without tasks:read', () => {
    mockAuth([]);
    mockTasks();

    const wrapper = mount(TicketTasksPanel, { props: { ticketId: 't-1', customerId: 'c-1' } });

    expect(wrapper.find('.ticket-tasks-panel').exists()).toBe(false);
  });

  it('renders an empty state with tasks:read and no tasks', () => {
    mockAuth(['tasks:read']);
    mockTasks([]);

    const wrapper = mount(TicketTasksPanel, { props: { ticketId: 't-1', customerId: 'c-1' } });

    expect(wrapper.text()).toContain('No tasks yet.');
  });

  it('the Add button is gated on tasks:write', () => {
    mockAuth(['tasks:read']);
    mockTasks([]);

    const withoutWrite = mount(TicketTasksPanel, { props: { ticketId: 't-1', customerId: 'c-1' } });
    expect(withoutWrite.text()).not.toContain('New task');

    mockedUseAuthStore.mockReset();
    mockAuth(['tasks:read', 'tasks:write']);
    const withWrite = mount(TicketTasksPanel, { props: { ticketId: 't-1', customerId: 'c-1' } });
    expect(withWrite.text()).toContain('New task');
  });

  it('completing a task calls setStatus scoped to the ticket panel and refreshes ticketTasks only', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    const store = mockTasks([makeTask()]);

    const wrapper = mount(TicketTasksPanel, { props: { ticketId: 't-1', customerId: 'c-1' } });
    await wrapper.find('input[type="checkbox"]').trigger('change');

    expect(store.setStatus).toHaveBeenCalledWith('task-1', 'DONE', true, 't-1');
  });

  it('loads ticket tasks for the given ticketId on mount', () => {
    mockAuth(['tasks:read']);
    const store = mockTasks([]);

    mount(TicketTasksPanel, { props: { ticketId: 't-1', customerId: 'c-1' } });

    expect(store.loadForTicket).toHaveBeenCalledWith('t-1');
  });
});
