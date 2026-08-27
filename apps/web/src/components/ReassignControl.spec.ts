import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { AxiosError } from 'axios';
import ReassignControl from './ReassignControl.vue';
import { useAuthStore } from '@/stores/auth';
import { useTicketsStore } from '@/stores/tickets';
import { useTasksStore } from '@/stores/tasks';
import { assignTicket, updateTicket, type Ticket } from '@/api/tickets';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/tickets', () => ({ useTicketsStore: vi.fn() }));
vi.mock('@/stores/tasks', () => ({ useTasksStore: vi.fn() }));
vi.mock('@/api/tickets', async () => {
  const actual = await vi.importActual<typeof import('@/api/tickets')>('@/api/tickets');

  return { ...actual, assignTicket: vi.fn(), updateTicket: vi.fn() };
});

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseTicketsStore = vi.mocked(useTicketsStore);
const mockedUseTasksStore = vi.mocked(useTasksStore);
const mockedAssignTicket = vi.mocked(assignTicket);
const mockedUpdateTicket = vi.mocked(updateTicket);

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

function mockAuth(permissions: string[], userId = 'me-1') {
  const store = reactive({ user: { id: userId }, can: (p: string) => permissions.includes(p) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);
}

function mockTickets() {
  const store = reactive({ loadDetail: vi.fn(async () => {}) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTicketsStore.mockReturnValue(store as any);

  return store;
}

function mockTasks(agents: { id: string; fullName: string }[] = []) {
  const store = reactive({ agents, loadAgents: vi.fn(async () => {}) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTasksStore.mockReturnValue(store as any);

  return store;
}

describe('ReassignControl', () => {
  it('renders nothing without tickets:write', () => {
    mockAuth([]);
    mockTickets();
    mockTasks();

    const wrapper = mount(ReassignControl, { props: { ticket: makeTicket() } });

    expect(wrapper.find('.reassign-control').exists()).toBe(false);
  });

  it('with tickets:assign renders the agent select and Unassign (when assigned)', () => {
    mockAuth(['tickets:write', 'tickets:assign']);
    mockTickets();
    mockTasks([{ id: 'agent-1', fullName: 'Nour Hassan' }]);

    const wrapper = mount(ReassignControl, {
      props: { ticket: makeTicket({ assignedAgent: { id: 'agent-1', fullName: 'Nour Hassan', email: 'nour@crm.local' } }) },
    });

    expect(wrapper.find('select').exists()).toBe(true);
    expect(wrapper.text()).toContain('Unassign');
  });

  it('without tickets:assign, an unassigned ticket offers only Claim', () => {
    mockAuth(['tickets:write']);
    mockTickets();
    mockTasks();

    const wrapper = mount(ReassignControl, { props: { ticket: makeTicket({ assignedAgent: null }) } });

    expect(wrapper.find('select').exists()).toBe(false);
    expect(wrapper.text()).toContain('Claim');
    expect(wrapper.text()).not.toContain('Release');
  });

  it('without tickets:assign, a ticket assigned to the caller offers only Release', () => {
    mockAuth(['tickets:write'], 'me-1');
    mockTickets();
    mockTasks();

    const wrapper = mount(ReassignControl, {
      props: { ticket: makeTicket({ assignedAgent: { id: 'me-1', fullName: 'Me', email: 'me@crm.local' } }) },
    });

    expect(wrapper.text()).toContain('Release');
    expect(wrapper.text()).not.toContain('Claim');
  });

  it('without tickets:assign, a ticket assigned to someone else offers only Claim', () => {
    mockAuth(['tickets:write'], 'me-1');
    mockTickets();
    mockTasks();

    const wrapper = mount(ReassignControl, {
      props: { ticket: makeTicket({ assignedAgent: { id: 'other-1', fullName: 'Other', email: 'other@crm.local' } }) },
    });

    expect(wrapper.text()).toContain('Claim');
    expect(wrapper.text()).not.toContain('Release');
  });

  it('Claim calls assignTicket (never updateTicket) with the caller id, then reloads the detail', async () => {
    mockAuth(['tickets:write'], 'me-1');
    const ticketsStore = mockTickets();
    mockTasks();
    mockedAssignTicket.mockResolvedValueOnce(makeTicket());

    const wrapper = mount(ReassignControl, { props: { ticket: makeTicket({ assignedAgent: null }) } });
    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockedAssignTicket).toHaveBeenCalledWith('t-1', 'me-1');
    expect(mockedUpdateTicket).not.toHaveBeenCalled();
    expect(ticketsStore.loadDetail).toHaveBeenCalledWith('t-1');
  });

  it('a 403 renders inline and the control stays mounted', async () => {
    mockAuth(['tickets:write'], 'me-1');
    mockTickets();
    mockTasks();
    const forbidden = new AxiosError('Request failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    forbidden.response = { status: 403, data: { message: 'nope' } } as any;
    mockedAssignTicket.mockRejectedValueOnce(forbidden);

    const wrapper = mount(ReassignControl, { props: { ticket: makeTicket({ assignedAgent: null }) } });
    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.reassign-control').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });
});
