import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { reactive, ref } from 'vue';
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

  const wrapper = mount(LoginView, { global: { plugins: [router] } });
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
});
