import { describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { fetchHealth } from './health';

describe('fetchHealth', () => {
  it('requests /health, not /api/health', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        status: 'ok',
        service: 'customer-support-crm-api',
        version: '0.1.0',
        environment: 'development',
        uptimeSeconds: 12,
        timestamp: '2026-08-25T00:00:00.000Z',
        database: { status: 'up', latencyMs: 1.2 },
      },
    });

    await fetchHealth();

    expect(getSpy).toHaveBeenCalledWith('/health', expect.objectContaining({
      validateStatus: expect.any(Function),
    }));
  });

  it('accepts 200 and 503 but rejects 500 via validateStatus', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} });

    await fetchHealth();

    const options = getSpy.mock.calls[0][1] as { validateStatus: (status: number) => boolean };

    expect(options.validateStatus(200)).toBe(true);
    expect(options.validateStatus(503)).toBe(true);
    expect(options.validateStatus(500)).toBe(false);
  });
});
