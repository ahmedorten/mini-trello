import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUsersStore } from './users';
import {
  createUser,
  listDepartments,
  listRoles,
  listUsers,
  setUserRoles,
  setUserStatus,
  type PaginatedUsers,
  type UserSummary,
} from '@/api/users';

vi.mock('@/api/users', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserStatus: vi.fn(),
  setUserRoles: vi.fn(),
  resetUserPassword: vi.fn(),
  listRoles: vi.fn(),
  listDepartments: vi.fn(),
}));

const mockedListUsers = vi.mocked(listUsers);
const mockedCreateUser = vi.mocked(createUser);
const mockedSetUserStatus = vi.mocked(setUserStatus);
const mockedSetUserRoles = vi.mocked(setUserRoles);
const mockedListRoles = vi.mocked(listRoles);
const mockedListDepartments = vi.mocked(listDepartments);

const sampleUser: UserSummary = {
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

const samplePage: PaginatedUsers = {
  items: [sampleUser],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

describe('useUsersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedListUsers.mockReset();
    mockedCreateUser.mockReset();
    mockedSetUserStatus.mockReset();
    mockedSetUserRoles.mockReset();
    mockedListRoles.mockReset();
    mockedListDepartments.mockReset();
  });

  it('load populates items and meta', async () => {
    mockedListUsers.mockResolvedValue(samplePage);
    const store = useUsersStore();

    await store.load();

    expect(store.items).toEqual([sampleUser]);
    expect(store.meta).toEqual(samplePage.meta);
    expect(store.error).toBeNull();
  });

  it('a rejection sets error and clears items', async () => {
    mockedListUsers.mockResolvedValueOnce(samplePage);
    const store = useUsersStore();
    await store.load();
    expect(store.items).toHaveLength(1);

    mockedListUsers.mockRejectedValueOnce(new Error('network down'));
    await store.load();

    expect(store.items).toEqual([]);
    expect(store.meta).toBeNull();
    expect(store.error).toBe('network down');
  });

  it('setSearch resets page to 1', async () => {
    mockedListUsers.mockResolvedValue(samplePage);
    const store = useUsersStore();
    store.filters.page = 3;

    store.setSearch('nour');
    await Promise.resolve();

    expect(store.filters.page).toBe(1);
    expect(store.filters.search).toBe('nour');
  });

  it('loadLookups failing still leaves items renderable from a prior load', async () => {
    mockedListUsers.mockResolvedValue(samplePage);
    const store = useUsersStore();
    await store.load();

    mockedListRoles.mockRejectedValue(new Error('roles down'));
    mockedListDepartments.mockResolvedValue([]);
    await store.loadLookups();

    expect(store.items).toEqual([sampleUser]);
    expect(store.error).toBe('roles down');
  });

  it('create calls load again on success and not on failure', async () => {
    mockedListUsers.mockResolvedValue(samplePage);
    const store = useUsersStore();

    mockedCreateUser.mockResolvedValueOnce(sampleUser);
    const ok = await store.create({
      email: 'a@crm.local',
      fullName: 'A',
      password: 'password123',
      roleKeys: ['support-agent'],
    });

    expect(ok).toBe(true);
    expect(mockedListUsers).toHaveBeenCalledTimes(1);

    mockedCreateUser.mockRejectedValueOnce(new Error('email taken'));
    const fail = await store.create({
      email: 'a@crm.local',
      fullName: 'A',
      password: 'password123',
      roleKeys: ['support-agent'],
    });

    expect(fail).toBe(false);
    expect(mockedListUsers).toHaveBeenCalledTimes(1);
    expect(store.error).toBe('email taken');
  });

  it('setStatus calls load again on success and not on failure', async () => {
    mockedListUsers.mockResolvedValue(samplePage);
    const store = useUsersStore();

    mockedSetUserStatus.mockResolvedValueOnce({ ...sampleUser, isActive: false });
    const ok = await store.setStatus('u-1', false);
    expect(ok).toBe(true);
    expect(mockedListUsers).toHaveBeenCalledTimes(1);

    mockedSetUserStatus.mockRejectedValueOnce(new Error('cannot deactivate self'));
    const fail = await store.setStatus('u-1', false);
    expect(fail).toBe(false);
    expect(mockedListUsers).toHaveBeenCalledTimes(1);
  });

  it('setRoles calls load again on success and not on failure', async () => {
    mockedListUsers.mockResolvedValue(samplePage);
    const store = useUsersStore();

    mockedSetUserRoles.mockResolvedValueOnce(sampleUser);
    const ok = await store.setRoles('u-1', ['support-agent']);
    expect(ok).toBe(true);
    expect(mockedListUsers).toHaveBeenCalledTimes(1);

    mockedSetUserRoles.mockRejectedValueOnce(new Error('unknown role key'));
    const fail = await store.setRoles('u-1', ['nope']);
    expect(fail).toBe(false);
    expect(mockedListUsers).toHaveBeenCalledTimes(1);
  });
});
