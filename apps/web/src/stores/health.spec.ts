import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHealthStore } from './health';
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
  uptimeSeconds: 42,
  timestamp: '2026-08-25T00:00:00.000Z',
  database: { status: 'up' as const, latencyMs: 2.1 },
};

const degradedResponse = {
  status: 'error' as const,
  service: 'customer-support-crm-api',
  version: '0.1.0',
  environment: 'development',
  uptimeSeconds: 42,
  timestamp: '2026-08-25T00:00:00.000Z',
  database: { status: 'down' as const, latencyMs: 0, message: 'connection refused' },
};

describe('useHealthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedFetchHealth.mockReset();
  });

  it('starts with empty state', () => {
    const store = useHealthStore();

    expect(store.data).toBeNull();
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('populates data on a healthy response', async () => {
    mockedFetchHealth.mockResolvedValue(healthyResponse);
    const store = useHealthStore();

    await store.load();

    expect(store.data).toEqual(healthyResponse);
    expect(store.isHealthy).toBe(true);
    expect(store.isDatabaseUp).toBe(true);
    expect(store.error).toBeNull();
    expect(store.lastCheckedAt).not.toBeNull();
  });

  it('keeps error null on a 503-shaped (resolved) database-down response', async () => {
    mockedFetchHealth.mockResolvedValue(degradedResponse);
    const store = useHealthStore();

    await store.load();

    expect(store.error).toBeNull();
    expect(store.isDatabaseUp).toBe(false);
    expect(store.data).toEqual(degradedResponse);
  });

  it('clears data and sets error on a rejection', async () => {
    mockedFetchHealth.mockRejectedValue(new Error('network down'));
    const store = useHealthStore();

    await store.load();

    expect(store.data).toBeNull();
    expect(store.error).toBe('network down');
    expect(store.isLoading).toBe(false);
  });

  it('toggles isLoading around the request in the success path', async () => {
    let resolvePromise: (value: typeof healthyResponse) => void;
    mockedFetchHealth.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const store = useHealthStore();

    const loadPromise = store.load();
    expect(store.isLoading).toBe(true);

    resolvePromise!(healthyResponse);
    await loadPromise;

    expect(store.isLoading).toBe(false);
  });

  it('toggles isLoading around the request in the failure path', async () => {
    let rejectPromise: (reason: Error) => void;
    mockedFetchHealth.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPromise = reject;
      }),
    );
    const store = useHealthStore();

    const loadPromise = store.load();
    expect(store.isLoading).toBe(true);

    rejectPromise!(new Error('boom'));
    await loadPromise;

    expect(store.isLoading).toBe(false);
  });
});
