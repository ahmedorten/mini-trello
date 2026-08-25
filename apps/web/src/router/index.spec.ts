import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { router } from './index';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);

function mockAuth(overrides: { isAuthenticated?: boolean; permissions?: string[] } = {}) {
  const permissions = overrides.permissions ?? [];

  mockedUseAuthStore.mockReturnValue({
    isRestored: true,
    isAuthenticated: overrides.isAuthenticated ?? false,
    restore: vi.fn(async () => {}),
    can: (permission: string) => permissions.includes(permission),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe('router', () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReset();
  });

  it('resolves / to the dashboard route', () => {
    expect(router.resolve('/').name).toBe('dashboard');
  });

  it('resolves /system-status to the system-status route', () => {
    expect(router.resolve('/system-status').name).toBe('system-status');
  });

  it('resolves /login to the login route', () => {
    expect(router.resolve('/login').name).toBe('login');
  });

  it('resolves /users to the users route', () => {
    expect(router.resolve('/users').name).toBe('users');
  });

  it('resolves /forbidden to the forbidden route', () => {
    expect(router.resolve('/forbidden').name).toBe('forbidden');
  });

  it('resolves /customers to the customers route', () => {
    expect(router.resolve('/customers').name).toBe('customers');
  });

  it('resolves /customers/new to the customer-create route, not customer-detail', () => {
    expect(router.resolve('/customers/new').name).toBe('customer-create');
  });

  it('resolves /customers/abc to the customer-detail route', () => {
    const resolved = router.resolve('/customers/abc');
    expect(resolved.name).toBe('customer-detail');
    expect(resolved.params.id).toBe('abc');
  });

  it('resolves /customers/abc/edit to the customer-edit route', () => {
    const resolved = router.resolve('/customers/abc/edit');
    expect(resolved.name).toBe('customer-edit');
    expect(resolved.params.id).toBe('abc');
  });

  it('redirects a signed-out visitor from /customers to login with a redirect query', async () => {
    mockAuth({ isAuthenticated: false });

    await router.push('/customers');

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/customers');
  });

  it('redirects to forbidden when signed in without customers:read', async () => {
    mockAuth({ isAuthenticated: true, permissions: [] });

    await router.push('/customers');

    expect(router.currentRoute.value.name).toBe('forbidden');
  });

  it('redirects to forbidden for /customers/new when missing customers:write', async () => {
    mockAuth({ isAuthenticated: true, permissions: ['customers:read'] });

    await router.push('/customers/new');

    expect(router.currentRoute.value.name).toBe('forbidden');
  });

  it('allows /customers/new when signed in with customers:write', async () => {
    mockAuth({ isAuthenticated: true, permissions: ['customers:read', 'customers:write'] });

    await router.push('/customers/new');

    expect(router.currentRoute.value.name).toBe('customer-create');
  });

  it('resolves an unknown path to the not-found catch-all', () => {
    expect(router.resolve('/nope').name).toBe('not-found');
  });

  it('redirects a signed-out visitor to login with a redirect query', async () => {
    mockAuth({ isAuthenticated: false });

    await router.push('/users');

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/users');
  });

  it('redirects to forbidden when signed in without the required permission', async () => {
    mockAuth({ isAuthenticated: true, permissions: [] });

    await router.push('/users');

    expect(router.currentRoute.value.name).toBe('forbidden');
  });

  it('allows /users when signed in with users:read', async () => {
    mockAuth({ isAuthenticated: true, permissions: ['users:read'] });

    await router.push('/users');

    expect(router.currentRoute.value.name).toBe('users');
  });

  it('redirects a signed-in visitor away from /login to the dashboard', async () => {
    mockAuth({ isAuthenticated: true });

    await router.push('/login');

    expect(router.currentRoute.value.name).toBe('dashboard');
  });

  it('updates document.title on navigation', async () => {
    mockAuth({ isAuthenticated: true, permissions: ['users:read'] });

    await router.push('/users');

    expect(document.title).toBe('Users · Customer Support CRM');
  });
});
