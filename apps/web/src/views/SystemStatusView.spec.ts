import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SystemStatusView from './SystemStatusView.vue';
import { fetchHealth } from '@/api/health';

vi.mock('@/api/health', () => ({
  fetchHealth: vi.fn(),
}));

const mockedFetchHealth = vi.mocked(fetchHealth);

const healthyResponse = {
  status: 'ok' as const,
  service: 'customer-support-crm-api',
  version: '0.1.0',
  environment: 'development',
  uptimeSeconds: 99,
  timestamp: '2026-08-25T00:00:00.000Z',
  database: { status: 'up' as const, latencyMs: 3.4 },
};

const degradedResponse = {
  status: 'error' as const,
  service: 'customer-support-crm-api',
  version: '0.1.0',
  environment: 'development',
  uptimeSeconds: 99,
  timestamp: '2026-08-25T00:00:00.000Z',
  database: { status: 'down' as const, latencyMs: 0, message: 'connection refused' },
};

function mountView() {
  return mount(SystemStatusView, {
    global: {
      plugins: [createPinia()],
      stubs: { RouterLink: true },
    },
  });
}

describe('SystemStatusView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedFetchHealth.mockReset();
  });

  it('shows the loading text before any data has arrived', async () => {
    mockedFetchHealth.mockReturnValue(new Promise(() => {}));

    const wrapper = mountView();
    await nextTick();

    expect(wrapper.text()).toContain('Checking API…');
  });

  it('renders the alert with the dev:api hint on error', async () => {
    mockedFetchHealth.mockRejectedValue(new Error('Cannot reach the API. Is it running on port 3000?'));

    const wrapper = mountView();
    await flushPromises();

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('Cannot reach the API. Is it running on port 3000?');
    expect(alert.text()).toContain('npm run dev:api');
  });

  it('renders healthy state fields', async () => {
    mockedFetchHealth.mockResolvedValue(healthyResponse);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('customer-support-crm-api');
    expect(wrapper.text()).toContain('development');
    expect(wrapper.text()).toContain('Connected');
  });

  it('renders database-down state with the driver message', async () => {
    mockedFetchHealth.mockResolvedValue(degradedResponse);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Unavailable');
    expect(wrapper.text()).toContain('connection refused');
  });

  it('disables Refresh while loading and calls load on click', async () => {
    mockedFetchHealth.mockResolvedValue(healthyResponse);

    const wrapper = mountView();
    await flushPromises();

    const button = wrapper.find('button');
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');
    expect(mockedFetchHealth).toHaveBeenCalledTimes(2);
  });
});
