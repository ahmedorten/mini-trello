import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import UsersView from './UsersView.vue';
import { useAuthStore } from '@/stores/auth';
import { useUsersStore } from '@/stores/users';
import type { UserSummary, Role, PaginationMeta } from '@/api/users';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/users', () => ({ useUsersStore: vi.fn() }));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseUsersStore = vi.mocked(useUsersStore);

const roles: Role[] = [
  { id: 'r-1', key: 'support-agent', name: 'Support Agent', description: null, permissions: [], userCount: 2 },
  {
    id: 'r-2',
    key: 'system-administrator',
    name: 'System Administrator',
    description: null,
    permissions: [],
    userCount: 1,
  },
];

function makeUser(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
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
    ...overrides,
  };
}

function mockAuth(permissions: string[], currentUserId = 'self', isAdmin = false) {
  const store = reactive({
    user: { id: currentUserId, roles: isAdmin ? ['system-administrator'] : ['support-agent'] },
    can: (permission: string) => permissions.includes(permission),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);

  return store;
}

function mockUsers(overrides: {
  items?: UserSummary[];
  meta?: PaginationMeta | null;
  error?: string | null;
  isLoading?: boolean;
} = {}) {
  const store = reactive({
    items: overrides.items ?? [],
    meta: overrides.meta ?? null,
    roles,
    departments: [],
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    filters: { page: 1, pageSize: 20, search: '', roleKey: '', departmentId: '', isActive: undefined },
    load: vi.fn(async () => {}),
    loadLookups: vi.fn(async () => {}),
    setSearch: vi.fn(),
    setRoleFilter: vi.fn(),
    setStatusFilter: vi.fn(),
    setPage: vi.fn(),
    create: vi.fn(async () => true),
    update: vi.fn(async () => true),
    setStatus: vi.fn(async () => true),
    setRoles: vi.fn(async () => true),
    resetPassword: vi.fn(async () => true),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseUsersStore.mockReturnValue(store as any);

  return store;
}

describe('UsersView', () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReset();
    mockedUseUsersStore.mockReset();
  });

  it('renders one table row per item, showing name, email, and roles', () => {
    mockAuth(['users:read']);
    mockUsers({ items: [makeUser()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = mount(UsersView);
    const row = wrapper.find('tbody tr');

    expect(row.text()).toContain('Nour Hassan');
    expect(row.text()).toContain('agent@crm.local');
    expect(row.text()).toContain('Support Agent');
  });

  it('renders the empty state when there are no items and no error', () => {
    mockAuth(['users:read']);
    mockUsers({ items: [] });

    const wrapper = mount(UsersView);

    expect(wrapper.text()).toContain('No users match these filters.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('renders role=alert and no table when the store has an error', () => {
    mockAuth(['users:read']);
    mockUsers({ items: [], error: 'Cannot reach the API.' });

    const wrapper = mount(UsersView);

    expect(wrapper.find('[role="alert"]').text()).toBe('Cannot reach the API.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('disables Previous on page 1 and Next on the last page', () => {
    mockAuth(['users:read']);
    mockUsers({
      items: [makeUser()],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    const wrapper = mount(UsersView);
    const buttons = wrapper.findAll('.users__pagination button');

    expect(buttons[0].text()).toBe('Previous');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].text()).toBe('Next');
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('changing the role filter resets the page and calls load', async () => {
    mockAuth(['users:read']);
    const store = mockUsers({ items: [makeUser()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = mount(UsersView);
    await wrapper.find('.users__filters select').setValue('support-agent');

    expect(store.setRoleFilter).toHaveBeenCalledWith('support-agent');
  });

  it('shows no action buttons for a caller with only users:read', () => {
    mockAuth(['users:read']);
    mockUsers({ items: [makeUser()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = mount(UsersView);
    const actions = wrapper.find('.users__actions');

    expect(actions.findAll('button')).toHaveLength(0);
  });

  it('shows Edit, Roles, Deactivate, and Reset password for a caller with matching permissions', () => {
    mockAuth(['users:read', 'users:write', 'roles:assign', 'users:deactivate'], 'someone-else');
    mockUsers({ items: [makeUser()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = mount(UsersView);
    const labels = wrapper.find('.users__actions').findAll('button').map((b) => b.text());

    expect(labels).toEqual(['Edit', 'Roles', 'Deactivate', 'Reset password']);
  });

  it('hides the deactivate control on the signed-in user own row', () => {
    mockAuth(['users:read', 'users:deactivate'], 'u-1');
    mockUsers({ items: [makeUser({ id: 'u-1' })], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = mount(UsersView);
    const labels = wrapper.find('.users__actions').findAll('button').map((b) => b.text());

    expect(labels).not.toContain('Deactivate');
  });

  it('omits system-administrator from the role picker for a non-administrator caller', async () => {
    mockAuth(['users:read', 'users:write'], 'self', false);
    mockUsers({ items: [makeUser()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = mount(UsersView);
    const createButton = wrapper.findAll('button').find((b) => b.text() === 'Create user')!;
    await createButton.trigger('click');

    const picker = wrapper.find('fieldset');
    expect(picker.text()).toContain('Support Agent');
    expect(picker.text()).not.toContain('System Administrator');
  });

  it('offers system-administrator in the role picker for an administrator caller', async () => {
    mockAuth(['users:read', 'users:write'], 'self', true);
    mockUsers({ items: [makeUser()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const wrapper = mount(UsersView);
    const createButton = wrapper.findAll('button').find((b) => b.text() === 'Create user')!;
    await createButton.trigger('click');

    const picker = wrapper.find('fieldset');
    expect(picker.text()).toContain('System Administrator');
  });

  it('deactivates only when window.confirm is stubbed true', async () => {
    mockAuth(['users:read', 'users:deactivate'], 'someone-else');
    const store = mockUsers({ items: [makeUser()], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(UsersView);
    const deactivateButton = wrapper
      .find('.users__actions')
      .findAll('button')
      .find((b) => b.text() === 'Deactivate')!;

    await deactivateButton.trigger('click');
    expect(store.setStatus).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await deactivateButton.trigger('click');
    expect(store.setStatus).toHaveBeenCalledWith('u-1', false);
  });
});
