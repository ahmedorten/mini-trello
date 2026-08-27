import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { reactive, ref } from 'vue';
import { createPinia } from 'pinia';
import LoginView from './LoginView.vue';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);

function mockAuthStore(loginImpl: (email: string, password: string) => Promise<boolean>) {
  // Wrapped in reactive() so template bindings react to changes, mirroring how
  // Pinia exposes a setup store's refs already unwrapped.
  const store = reactive({
    error: ref<string | null>(null),
    isLoading: ref(false),
    login: vi.fn(loginImpl),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);

  return store;
}

async function mountView(initialPath = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
      { path: '/users', name: 'users', component: { template: '<div>Users</div>' } },
    ],
  });

  router.push(initialPath);
  await router.isReady();

  const wrapper = mount(LoginView, { global: { plugins: [router, createPinia()] } });
  await wrapper.vm.$nextTick();

  return { wrapper, router };
}

describe('LoginView', () => {
  it('renders email and password inputs and disables submit while both are empty', async () => {
    mockAuthStore(async () => true);
    const { wrapper } = await mountView();

    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
  });

  it('calls auth.login with the typed values on submit', async () => {
    const store = mockAuthStore(async () => true);
    const { wrapper } = await mountView();

    await wrapper.find('input[type="email"]').setValue('admin@crm.local');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await wrapper.vm.$nextTick();

    expect(store.login).toHaveBeenCalledWith('admin@crm.local', 'password123');
  });

  it('renders auth.error inside role=alert on a failed login', async () => {
    const store = mockAuthStore(async () => false);
    const { wrapper } = await mountView();

    store.error = 'Invalid email or password.';
    await wrapper.vm.$nextTick();

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toBe('Invalid email or password.');
  });

  it('replaces to / by default on a successful login', async () => {
    mockAuthStore(async () => true);
    const { wrapper, router } = await mountView();
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="email"]').setValue('admin@crm.local');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await wrapper.vm.$nextTick();

    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('replaces to the redirect query when present and same-site', async () => {
    mockAuthStore(async () => true);
    const { wrapper, router } = await mountView('/login?redirect=%2Fusers');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="email"]').setValue('admin@crm.local');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await wrapper.vm.$nextTick();

    expect(replaceSpy).toHaveBeenCalledWith('/users');
  });

  it('falls back to / for an absolute-URL redirect (open-redirect guard)', async () => {
    mockAuthStore(async () => true);
    const { wrapper, router } = await mountView('/login?redirect=https://evil.example');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="email"]').setValue('admin@crm.local');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await wrapper.vm.$nextTick();

    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('falls back to / for a protocol-relative redirect (open-redirect guard)', async () => {
    mockAuthStore(async () => true);
    const { wrapper, router } = await mountView('/login?redirect=//evil.example');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="email"]').setValue('admin@crm.local');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await wrapper.vm.$nextTick();

    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('never renders the typed password outside the bound input value', async () => {
    mockAuthStore(async () => true);
    const { wrapper } = await mountView();

    await wrapper.find('input[type="password"]').setValue('super-secret-1');
    await wrapper.vm.$nextTick();

    expect(wrapper.html()).not.toContain('super-secret-1');
  });

  it('renders one entry per dev test user with its role label', async () => {
    mockAuthStore(async () => true);
    const { wrapper } = await mountView();

    const rows = wrapper.findAll('.login__test-user');
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain('Dev System Administrator');
    expect(rows[0].text()).toContain('System Administrator');
    expect(rows[0].text()).toContain('dev.admin@crm.local');
  });

  it('clicking Use fills the email and password inputs', async () => {
    mockAuthStore(async () => true);
    const { wrapper } = await mountView();

    const useButton = wrapper.findAll('.login__test-user')[1].find('button');
    await useButton.trigger('click');

    expect((wrapper.find('input[type="email"]').element as HTMLInputElement).value).toBe('dev.agent@crm.local');
  });

  it('clicking Use does not call auth.login', async () => {
    const store = mockAuthStore(async () => true);
    const { wrapper } = await mountView();

    const useButton = wrapper.findAll('.login__test-user')[0].find('button');
    await useButton.trigger('click');

    expect(store.login).not.toHaveBeenCalled();
  });

  it('clicking Use does not navigate', async () => {
    mockAuthStore(async () => true);
    const { wrapper, router } = await mountView();
    const replaceSpy = vi.spyOn(router, 'replace');

    const useButton = wrapper.findAll('.login__test-user')[0].find('button');
    await useButton.trigger('click');

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('never renders the prefilled password anywhere in the markup', async () => {
    mockAuthStore(async () => true);
    const { wrapper } = await mountView();

    const useButton = wrapper.findAll('.login__test-user')[0].find('button');
    await useButton.trigger('click');
    await wrapper.vm.$nextTick();

    // v-model binds the value as a DOM property, not a static `value=`
    // attribute — this is the picker-path counterpart of the existing
    // typed-password security test (135–143).
    expect(wrapper.html()).not.toMatch(/<input[^>]*type="password"[^>]*value=/);
  });
});

async function mountFreshView(initialPath = '/login') {
  // vi.resetModules + a dynamic import is what lets '@/config/devTestUsers'
  // be re-mocked per test below. Because resetModules also re-evaluates the
  // '@/stores/auth' vi.mock factory, the auth store must be re-imported and
  // re-mocked here too — the top-level `mockedUseAuthStore` is bound to a
  // now-stale module instance.
  const { default: FreshLoginView } = await import('./LoginView.vue');
  const { useAuthStore: freshUseAuthStore } = await import('@/stores/auth');

  const store = reactive({
    error: ref<string | null>(null),
    isLoading: ref(false),
    login: vi.fn(async () => true),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(freshUseAuthStore).mockReturnValue(store as any);

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: FreshLoginView },
      { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
    ],
  });

  router.push(initialPath);
  await router.isReady();

  const wrapper = mount(FreshLoginView, {
    global: { plugins: [router, createPinia()] },
    attachTo: document.body,
  });
  await wrapper.vm.$nextTick();

  return { wrapper, router, store };
}

describe('LoginView with no dev test-user password configured', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/config/devTestUsers', async () => {
      const actual = await vi.importActual<typeof import('@/config/devTestUsers')>('@/config/devTestUsers');

      return { ...actual, devTestUserPassword: '' };
    });
  });

  afterEach(() => {
    vi.doUnmock('@/config/devTestUsers');
  });

  it('renders the missing-password warning and focuses the password input when the env var is empty', async () => {
    const { wrapper } = await mountFreshView();

    const useButton = wrapper.findAll('.login__test-user')[0].find('button');
    await useButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Set VITE_DEV_TEST_USER_PASSWORD');
    expect(document.activeElement).toBe(wrapper.find('input[type="password"]').element);

    wrapper.unmount();
  });
});

describe('LoginView with devTestUsers empty (production-shaped)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/config/devTestUsers', () => ({
      devTestUsers: [],
      devTestUserPassword: '',
      devTestUserMessages: { en: {}, ar: {} },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/config/devTestUsers');
  });

  it('renders no picker section when devTestUsers is empty', async () => {
    const { wrapper } = await mountFreshView();

    expect(wrapper.find('.login__test-users').exists()).toBe(false);

    wrapper.unmount();
  });
});
