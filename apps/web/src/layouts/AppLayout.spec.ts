import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { reactive } from 'vue';
import AppLayout from './AppLayout.vue';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);

const routes = [
  { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
  { path: '/system-status', name: 'system-status', component: { template: '<div>Status</div>' } },
  { path: '/users', name: 'users', component: { template: '<div>Users</div>' } },
  { path: '/customers', name: 'customers', component: { template: '<div>Customers</div>' } },
  { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
];

function mockAuthStore(overrides: {
  isAuthenticated?: boolean;
  permissions?: string[];
  fullName?: string;
  roles?: string[];
  mustChangePassword?: boolean;
} = {}) {
  const permissions = overrides.permissions ?? [];

  const store = reactive({
    isAuthenticated: overrides.isAuthenticated ?? true,
    user: overrides.isAuthenticated === false
      ? null
      : {
          fullName: overrides.fullName ?? 'System Administrator',
          roles: overrides.roles ?? ['system-administrator'],
          mustChangePassword: overrides.mustChangePassword ?? false,
        },
    can: (permission: string) => permissions.includes(permission),
    logout: vi.fn(async () => {}),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);

  return store;
}

async function mountLayout() {
  const router = createRouter({ history: createWebHistory(), routes });
  router.push('/');
  await router.isReady();

  return { wrapper: mount(AppLayout, { global: { plugins: [router] } }), router };
}

describe('AppLayout', () => {
  it('renders the brand text', async () => {
    mockAuthStore();
    const { wrapper } = await mountLayout();

    expect(wrapper.text()).toContain('Customer Support CRM');
  });

  it('renders a nav landmark with exactly two links when signed in without users:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: [] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    expect(nav.exists()).toBe(true);

    const links = nav.findAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].attributes('href')).toBe('/');
    expect(links[1].attributes('href')).toBe('/system-status');
  });

  it('renders no nav and no sign-out button when signed out', async () => {
    mockAuthStore({ isAuthenticated: false });
    const { wrapper } = await mountLayout();

    expect(wrapper.find('nav[aria-label="Main navigation"]').exists()).toBe(false);
    expect(wrapper.find('.layout__signout').exists()).toBe(false);
    expect(wrapper.text()).toContain('Customer Support CRM');
  });

  it('renders the Users link when signed in with users:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['users:read'] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).toContain('Users');
  });

  it('omits the Users link when signed in without users:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: [] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).not.toContain('Users');
  });

  it('renders the Customers link when signed in with customers:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['customers:read'] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).toContain('Customers');
  });

  it('omits the Customers link when signed in without customers:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: [] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).not.toContain('Customers');
  });

  it('signs out via auth.logout and redirects to login', async () => {
    const store = mockAuthStore({ isAuthenticated: true });
    const { wrapper, router } = await mountLayout();
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('.layout__signout').trigger('click');
    await wrapper.vm.$nextTick();

    expect(store.logout).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith({ name: 'login' });
  });

  it('renders the must-change-password banner when true', async () => {
    mockAuthStore({ isAuthenticated: true, mustChangePassword: true });
    const { wrapper } = await mountLayout();

    expect(wrapper.text()).toContain('Your password was set by an administrator');
  });

  it('does not render the must-change-password banner when false', async () => {
    mockAuthStore({ isAuthenticated: true, mustChangePassword: false });
    const { wrapper } = await mountLayout();

    expect(wrapper.text()).not.toContain('Your password was set by an administrator');
  });
});
