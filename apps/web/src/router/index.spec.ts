import { describe, expect, it } from 'vitest';
import { router } from './index';

describe('router', () => {
  it('resolves / to the dashboard route', () => {
    expect(router.resolve('/').name).toBe('dashboard');
  });

  it('resolves /system-status to the system-status route', () => {
    expect(router.resolve('/system-status').name).toBe('system-status');
  });

  it('resolves an unknown path to the not-found catch-all', () => {
    expect(router.resolve('/nope').name).toBe('not-found');
  });
});
