import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './auth';
import { fetchCurrentUser, login, logout, refreshSession, type AuthUser } from '@/api/auth';
import { resetSession } from '@/api/session';

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

const mockedLogin = vi.mocked(login);
const mockedLogout = vi.mocked(logout);
const mockedRefresh = vi.mocked(refreshSession);
const mockedFetchCurrentUser = vi.mocked(fetchCurrentUser);

const authUser: AuthUser = {
  id: 'u-1',
  email: 'admin@crm.local',
  fullName: 'System Administrator',
  mustChangePassword: false,
  departmentId: null,
  branchId: null,
  roles: ['system-administrator'],
  permissions: ['users:read', 'users:write'],
};

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetSession();
    mockedLogin.mockReset();
    mockedLogout.mockReset();
    mockedRefresh.mockReset();
    mockedFetchCurrentUser.mockReset();
  });

  it('login on success stores the token, sets the user, and clears error', async () => {
    mockedLogin.mockResolvedValue({ accessToken: 'tok', expiresInSeconds: 900, tokenType: 'Bearer' });
    mockedFetchCurrentUser.mockResolvedValue(authUser);
    const store = useAuthStore();

    const ok = await store.login('admin@crm.local', 'password123');

    expect(ok).toBe(true);
    expect(store.user).toEqual(authUser);
    expect(store.error).toBeNull();
    expect(store.isAuthenticated).toBe(true);
    expect(store.peekToken()).toBe('tok');
  });

  it('login on rejection clears the token, sets error, and returns false', async () => {
    mockedLogin.mockRejectedValue(new Error('Invalid email or password.'));
    const store = useAuthStore();

    const ok = await store.login('admin@crm.local', 'wrong');

    expect(ok).toBe(false);
    expect(store.user).toBeNull();
    expect(store.error).toBe('Invalid email or password.');
    expect(store.peekToken()).toBeNull();
  });

  it('toggles isLoading around the login request', async () => {
    let resolveLogin: (value: { accessToken: string; expiresInSeconds: number; tokenType: string }) => void;
    mockedLogin.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    mockedFetchCurrentUser.mockResolvedValue(authUser);
    const store = useAuthStore();

    const loginPromise = store.login('admin@crm.local', 'password123');
    expect(store.isLoading).toBe(true);

    resolveLogin!({ accessToken: 'tok', expiresInSeconds: 900, tokenType: 'Bearer' });
    await loginPromise;

    expect(store.isLoading).toBe(false);
  });

  it('restore with a successful refresh sets the user and isRestored', async () => {
    mockedRefresh.mockResolvedValue({ accessToken: 'tok', expiresInSeconds: 900, tokenType: 'Bearer' });
    mockedFetchCurrentUser.mockResolvedValue(authUser);
    const store = useAuthStore();

    await store.restore();

    expect(store.user).toEqual(authUser);
    expect(store.isRestored).toBe(true);
  });

  it('restore with a rejected refresh sets isRestored, leaves user null, and leaves error null', async () => {
    mockedRefresh.mockRejectedValue(new Error('no cookie'));
    const store = useAuthStore();

    await store.restore();

    expect(store.isRestored).toBe(true);
    expect(store.user).toBeNull();
    expect(store.error).toBeNull();
  });

  it('restore called twice makes only one refreshSession call', async () => {
    mockedRefresh.mockResolvedValue({ accessToken: 'tok', expiresInSeconds: 900, tokenType: 'Bearer' });
    mockedFetchCurrentUser.mockResolvedValue(authUser);
    const store = useAuthStore();

    await store.restore();
    await store.restore();

    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('logout clears the token and user even when the request rejects', async () => {
    mockedLogin.mockResolvedValue({ accessToken: 'tok', expiresInSeconds: 900, tokenType: 'Bearer' });
    mockedFetchCurrentUser.mockResolvedValue(authUser);
    mockedLogout.mockRejectedValue(new Error('network down'));
    const store = useAuthStore();
    await store.login('admin@crm.local', 'password123');

    await store.logout();

    expect(store.user).toBeNull();
    expect(store.peekToken()).toBeNull();
  });

  it('can/canAny reflect the held permissions', async () => {
    mockedLogin.mockResolvedValue({ accessToken: 'tok', expiresInSeconds: 900, tokenType: 'Bearer' });
    mockedFetchCurrentUser.mockResolvedValue(authUser);
    const store = useAuthStore();

    expect(store.can('users:read')).toBe(false);

    await store.login('admin@crm.local', 'password123');

    expect(store.can('users:read')).toBe(true);
    expect(store.can('roles:assign')).toBe(false);
    expect(store.canAny('roles:assign', 'users:read')).toBe(true);
    expect(store.canAny('roles:assign', 'departments:read')).toBe(false);
  });

  it('shares one refresh promise across concurrent callers, and starts a new one after settling', async () => {
    let resolveFirst: (value: { accessToken: string; expiresInSeconds: number; tokenType: string }) => void;
    mockedRefresh.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    const store = useAuthStore();

    const calls = [
      store.refresh(),
      store.refresh(),
      store.refresh(),
      store.refresh(),
      store.refresh(),
    ];

    resolveFirst!({ accessToken: 'tok-1', expiresInSeconds: 900, tokenType: 'Bearer' });
    const results = await Promise.all(calls);

    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['tok-1', 'tok-1', 'tok-1', 'tok-1', 'tok-1']);

    mockedRefresh.mockResolvedValueOnce({ accessToken: 'tok-2', expiresInSeconds: 900, tokenType: 'Bearer' });
    const second = await store.refresh();

    expect(mockedRefresh).toHaveBeenCalledTimes(2);
    expect(second).toBe('tok-2');
  });
});
