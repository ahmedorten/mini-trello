import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AppLayout from './AppLayout.vue';
import { useAuthStore } from '@/stores/auth';
import { useLocaleStore } from '@/stores/locale';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);

const routes = [
  { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
  { path: '/system-status', name: 'system-status', component: { template: '<div>Status</div>' } },
  { path: '/users', name: 'users', component: { template: '<div>Users</div>' } },
  { path: '/customers', name: 'customers', component: { template: '<div>Customers</div>' } },
  { path: '/tickets', name: 'tickets', component: { template: '<div>Tickets</div>' } },
  { path: '/workspace', name: 'workspace', component: { template: '<div>Workspace</div>' } },
  { path: '/tasks', name: 'tasks', component: { template: '<div>Tasks</div>' } },
  { path: '/communication', name: 'communication', component: { template: '<div>Comms</div>' } },
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

async function mountLayout(initialPath = '/') {
  const router = createRouter({ history: createWebHistory(), routes });
  router.push(initialPath);
  await router.isReady();

  const pinia = createPinia();
  setActivePinia(pinia);

  return { wrapper: mount(AppLayout, { global: { plugins: [router, pinia] } }), router };
}

describe('AppLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

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

  it('renders the Tickets link when signed in with tickets:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['tickets:read'] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).toContain('Tickets');
  });

  it('omits the Tickets link when signed in without tickets:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: [] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).not.toContain('Tickets');
  });

  it('renders the Workspace link when signed in with tickets:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['tickets:read'] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).toContain('Workspace');
  });

  it('omits the Workspace link when signed in without tickets:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: [] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).not.toContain('Workspace');
  });

  it('renders the Tasks link when signed in with tasks:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['tasks:read'] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).toContain('Tasks');
  });

  it('omits the Tasks link when signed in without tasks:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: [] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).not.toContain('Tasks');
  });

  it('renders the Communication link when signed in with customers:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['customers:read'] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).toContain('Communication');
  });

  it('omits the Communication link without customers:read', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: [] });
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    const links = nav.findAll('a');
    expect(links.map((link) => link.text())).not.toContain('Communication');
  });

  it('puts Communication in the Work group, not Records', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['customers:read', 'tasks:read'] });
    const { wrapper } = await mountLayout();

    const groups = wrapper.findAll('.layout__nav-group');
    const workGroup = groups.find((group) => group.find('h2').text() === 'Work')!;

    expect(workGroup.findAll('a').map((link) => link.text())).toContain('Communication');
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

  it('dismisses the must-change-password banner on click', async () => {
    mockAuthStore({ isAuthenticated: true, mustChangePassword: true });
    const { wrapper } = await mountLayout();

    expect(wrapper.text()).toContain('Your password was set by an administrator');

    const dismissButton = wrapper.findAll('button').find((b) => b.text() === 'Dismiss')!;
    await dismissButton.trigger('click');

    expect(wrapper.text()).not.toContain('Your password was set by an administrator');
  });

  it('renders the skip link as the first focusable element, targeting #main-content', async () => {
    mockAuthStore();
    const { wrapper } = await mountLayout();

    const firstFocusable = wrapper.find('a, button, input, select, textarea, [tabindex]');
    expect(firstFocusable.classes()).toContain('skip-link');
    expect(firstFocusable.attributes('href')).toBe('#main-content');
    expect(wrapper.find('#main-content').attributes('tabindex')).toBe('-1');
  });

  it('renders an icon and a label for every nav item', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['tickets:read'] });
    const { wrapper } = await mountLayout();

    const links = wrapper.findAll('.layout__link');
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      expect(link.find('svg').exists()).toBe(true);
      expect(link.find('span').text().length).toBeGreaterThan(0);
    }
  });

  it('marks the active route link with aria-current=page', async () => {
    mockAuthStore();
    const { wrapper } = await mountLayout('/');

    const dashboardLink = wrapper.find('a[href="/"]');
    expect(dashboardLink.attributes('aria-current')).toBe('page');
  });

  it('toggles the drawer open class via the menu button', async () => {
    mockAuthStore();
    const { wrapper } = await mountLayout();

    const nav = wrapper.find('.layout__nav');
    expect(nav.classes()).not.toContain('layout__nav--open');

    await wrapper.find('.layout__menu-toggle').trigger('click');
    expect(wrapper.find('.layout__nav').classes()).toContain('layout__nav--open');
  });

  it('closes the drawer on navigation', async () => {
    mockAuthStore({ isAuthenticated: true, permissions: ['tickets:read'] });
    const { wrapper, router } = await mountLayout();

    await wrapper.find('.layout__menu-toggle').trigger('click');
    expect(wrapper.find('.layout__nav').classes()).toContain('layout__nav--open');

    await router.push('/tickets');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.layout__nav').classes()).not.toContain('layout__nav--open');
  });

  it('renders the LocaleSwitcher when signed in', async () => {
    mockAuthStore();
    const { wrapper } = await mountLayout();

    expect(wrapper.find('select.locale-switcher').exists()).toBe(true);
  });

  it('renders without throwing and sets dir=rtl when the locale store is set to ar', async () => {
    mockAuthStore();
    const { wrapper } = await mountLayout();

    const localeStore = useLocaleStore();
    localeStore.setLocale('ar');
    await wrapper.vm.$nextTick();

    expect(document.documentElement.dir).toBe('rtl');
  });
});
