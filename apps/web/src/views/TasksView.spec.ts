import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { reactive } from 'vue';
import { createPinia } from 'pinia';
import TasksView from './TasksView.vue';
import AppConfirmDialog from '@/components/AppConfirmDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { useTasksStore } from '@/stores/tasks';
import type { AgentTask } from '@/api/tasks';
import type { PaginationMeta } from '@/api/users';

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
    ticket: null,
    customer: null,
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

function mockTasks(overrides: {
  items?: AgentTask[];
  meta?: PaginationMeta | null;
  isLoading?: boolean;
  error?: string | null;
} = {}) {
  const store = reactive({
    items: overrides.items ?? [],
    meta: overrides.meta ?? null,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    filters: { page: 1, pageSize: 20, scope: 'mine', status: '', overdueOnly: false, sort: '', order: 'asc' },
    load: vi.fn(async () => {}),
    setScopeFilter: vi.fn(),
    setStatusFilter: vi.fn(),
    setOverdueOnly: vi.fn(),
    setPage: vi.fn(),
    setSort: vi.fn(),
    setPageSize: vi.fn(),
    setStatus: vi.fn(async () => true),
    remove: vi.fn(async () => true),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTasksStore.mockReturnValue(store as any);

  return store;
}

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/tasks', name: 'tasks', component: { template: '<div />' } },
      { path: '/workspace/:id', name: 'workspace-ticket', component: { template: '<div />' } },
      { path: '/customers/:id', name: 'customer-detail', component: { template: '<div />' } },
    ],
  });
  router.push('/tasks');
  await router.isReady();

  const wrapper = mount(TasksView, { global: { plugins: [router, createPinia()] } });
  await wrapper.vm.$nextTick();

  return wrapper;
}

describe('TasksView', () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReset();
    mockedUseTasksStore.mockReset();
  });

  it('renders the loading state exclusively', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ isLoading: true });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Loading…');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders the error state exclusively', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ error: 'Cannot reach the API.' });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Cannot reach the API.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders the empty state exclusively', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ items: [] });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('No tasks yet.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders content when items are present', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();

    expect(wrapper.find('table').exists()).toBe(true);
    expect(wrapper.text()).toContain('Call back re: refund status');
  });

  it('the scope select offers all only with tasks:manage', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const without = await mountView();
    const scopeSelect = without.findAll('select')[0];
    expect(scopeSelect.findAll('option').map((o) => o.text())).toEqual(['My tasks']);

    mockedUseAuthStore.mockReset();
    mockAuth(['tasks:read', 'tasks:manage']);
    const withManage = await mountView();
    const scopeSelectManage = withManage.findAll('select')[0];
    expect(scopeSelectManage.findAll('option').map((o) => o.text())).toEqual(['My tasks', 'All tasks']);
  });

  it('filters call their matching store actions', async () => {
    mockAuth(['tasks:read', 'tasks:manage']);
    const store = mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    const selects = wrapper.findAll('select');

    await selects[0].setValue('all');
    expect(store.setScopeFilter).toHaveBeenCalledWith('all');

    await selects[1].setValue('DONE');
    expect(store.setStatusFilter).toHaveBeenCalledWith('DONE');

    await wrapper.find('input[type="checkbox"]').setValue(true);
    expect(store.setOverdueOnly).toHaveBeenCalledWith(true);
  });

  it('pagination bounds: disables Previous on page 1 and Next on the last page', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    const buttons = wrapper.findAll('.app-pagination button');

    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('New task opens the modal and is gated on tasks:write', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ items: [] });

    const withoutWrite = await mountView();
    expect(withoutWrite.text()).not.toContain('New task');

    mockedUseAuthStore.mockReset();
    mockAuth(['tasks:read', 'tasks:write']);
    const withWrite = await mountView();
    expect(withWrite.text()).toContain('New task');

    await withWrite.find('button').trigger('click');
    expect(withWrite.findComponent({ name: 'AppModal' }).props('open')).toBe(true);
  });

  it('renders a sortable header for each API-sortable column and a plain th for the rest', async () => {
    mockAuth(['tasks:read']);
    mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    const sortableHeaders = wrapper.findAll('th[aria-sort]');
    const plainHeaders = wrapper.findAll('th:not([aria-sort])');

    expect(sortableHeaders).toHaveLength(3);
    expect(plainHeaders.map((h) => h.text())).toEqual(
      expect.arrayContaining(['Linked ticket', 'Linked customer', 'Assignee', 'Actions']),
    );
  });

  it('calls store.setSort with the API field name when a header button is clicked', async () => {
    mockAuth(['tasks:read']);
    const store = mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    await wrapper.find('th[aria-sort] button').trigger('click');

    expect(store.setSort).toHaveBeenCalledWith('title');
  });

  it('calls store.setPageSize when the page-size select changes', async () => {
    mockAuth(['tasks:read']);
    const store = mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    await wrapper.find('.app-pagination__page-size select').setValue('50');

    expect(store.setPageSize).toHaveBeenCalledWith(50);
  });

  it('clicking Delete opens the confirm dialog and calls remove only after Confirm', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    const store = mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    const deleteButton = wrapper.find('.data-table__actions').findAll('button').find((b) => b.text() === 'Delete')!;
    await deleteButton.trigger('click');

    expect(store.remove).not.toHaveBeenCalled();
    expect(wrapper.findComponent(AppConfirmDialog).props('open')).toBe(true);

    const confirmButton = wrapper.find('.form-actions').findAll('button')[1];
    await confirmButton.trigger('click');

    expect(store.remove).toHaveBeenCalledWith('task-1');
  });

  it('clicking Cancel closes the dialog and never calls remove', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    const store = mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    const deleteButton = wrapper.find('.data-table__actions').findAll('button').find((b) => b.text() === 'Delete')!;
    await deleteButton.trigger('click');

    const cancelButton = wrapper.find('.form-actions').findAll('button')[0];
    await cancelButton.trigger('click');

    expect(wrapper.findComponent(AppConfirmDialog).props('open')).toBe(false);
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('a second Confirm click does not call remove twice', async () => {
    mockAuth(['tasks:read', 'tasks:write']);
    const store = mockTasks({ items: [makeTask()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = await mountView();
    const deleteButton = wrapper.find('.data-table__actions').findAll('button').find((b) => b.text() === 'Delete')!;
    await deleteButton.trigger('click');

    const confirmButton = wrapper.find('.form-actions').findAll('button')[1];
    await confirmButton.trigger('click');
    await confirmButton.trigger('click');

    expect(store.remove).toHaveBeenCalledTimes(1);
  });
});
