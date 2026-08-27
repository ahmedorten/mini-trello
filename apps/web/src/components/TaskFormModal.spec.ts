import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TaskFormModal from './TaskFormModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useTasksStore } from '@/stores/tasks';
import type { AgentTask } from '@/api/tasks';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/tasks', () => ({ useTasksStore: vi.fn() }));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseTasksStore = vi.mocked(useTasksStore);

const sampleTask: AgentTask = {
  id: 'task-1',
  title: 'Call back re: refund status',
  notes: 'Customer is upset',
  status: 'IN_PROGRESS',
  dueAt: '2026-08-28T10:00:00.000Z',
  remindAt: null,
  completedAt: null,
  assignee: { id: 'agent-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  createdBy: { id: 'agent-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  ticket: { id: 't-1', subject: 'Cannot log in' },
  customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
  isOverdue: false,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

function mockAuth(permissions: string[]) {
  const store = reactive({ can: (p: string) => permissions.includes(p) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);
}

function mockTasks() {
  const store = reactive({
    agents: [{ id: 'agent-1', fullName: 'Nour Hassan' }],
    error: null,
    isSaving: false,
    loadAgents: vi.fn(async () => {}),
    create: vi.fn(async () => true),
    update: vi.fn(async () => true),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTasksStore.mockReturnValue(store as any);

  return store;
}

describe('TaskFormModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedUseAuthStore.mockReset();
    mockedUseTasksStore.mockReset();
  });

  it('create-mode defaults to an empty title and OPEN status', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    mockTasks();

    const wrapper = mount(TaskFormModal, { props: { open: true, task: null } });
    await wrapper.vm.$nextTick();

    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('OPEN');
  });

  it('edit-mode populates from a local copy — mutating a field does not mutate the store object', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    mockTasks();

    const wrapper = mount(TaskFormModal, { props: { open: true, task: sampleTask } });
    await wrapper.vm.$nextTick();

    const titleInput = wrapper.find('input[type="text"]');
    expect((titleInput.element as HTMLInputElement).value).toBe(sampleTask.title);

    await titleInput.setValue('Changed title');

    expect(sampleTask.title).toBe('Call back re: refund status');
  });

  it('the assignee select is present only with tasks:manage', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    mockTasks();

    const without = mount(TaskFormModal, { props: { open: true, task: null } });
    await without.vm.$nextTick();
    expect(without.findAll('select')).toHaveLength(1);

    mockedUseAuthStore.mockReset();
    mockAuth(['tasks:read', 'tasks:write', 'tasks:manage']);
    const withManage = mount(TaskFormModal, { props: { open: true, task: null } });
    await withManage.vm.$nextTick();
    expect(withManage.findAll('select')).toHaveLength(2);
  });

  it('create payload uses undefined for empty optionals; edit payload uses null', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    const store = mockTasks();

    const createWrapper = mount(TaskFormModal, { props: { open: true, task: null } });
    await createWrapper.vm.$nextTick();
    await createWrapper.find('input[type="text"]').setValue('New task');
    await createWrapper.find('form').trigger('submit.prevent');

    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New task', notes: undefined, dueAt: undefined, remindAt: undefined }),
      false,
      undefined,
    );

    const editWrapper = mount(TaskFormModal, { props: { open: true, task: { ...sampleTask, notes: null, dueAt: null } } });
    await editWrapper.vm.$nextTick();
    await editWrapper.find('form').trigger('submit.prevent');

    expect(store.update).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ notes: null, dueAt: null, remindAt: null }),
      false,
      undefined,
    );
  });

  it('customerId is derived from ticketId when prefilled from a ticket context, with no separate customer picker', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    const store = mockTasks();

    const wrapper = mount(TaskFormModal, {
      props: { open: true, task: null, ticketId: 't-1', customerId: 'c-1', fromTicketPanel: true },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('select[name]')).toHaveLength(0);
    await wrapper.find('input[type="text"]').setValue('Task from panel');
    await wrapper.find('form').trigger('submit.prevent');

    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 't-1', customerId: 'c-1' }),
      true,
      't-1',
    );
  });

  it('success closes the modal', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    mockTasks();

    const wrapper = mount(TaskFormModal, { props: { open: true, task: null } });
    await wrapper.vm.$nextTick();
    await wrapper.find('input[type="text"]').setValue('New task');
    await wrapper.find('form').trigger('submit.prevent');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });
});
