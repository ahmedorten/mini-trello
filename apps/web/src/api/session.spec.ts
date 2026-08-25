import { afterEach, describe, expect, it } from 'vitest';
import {
  getAccessToken,
  getSessionHandlers,
  registerSessionHandlers,
  resetSession,
  setAccessToken,
} from './session';

describe('session', () => {
  afterEach(() => {
    resetSession();
  });

  it('round-trips the access token', () => {
    expect(getAccessToken()).toBeNull();

    setAccessToken('a-token');

    expect(getAccessToken()).toBe('a-token');
  });

  it('returns null handlers before registration', () => {
    expect(getSessionHandlers()).toBeNull();
  });

  it('returns the registered handlers', () => {
    const handlers = { refresh: async () => 'x', onSessionLost: () => {} };

    registerSessionHandlers(handlers);

    expect(getSessionHandlers()).toBe(handlers);
  });

  it('resetSession clears both the token and the handlers', () => {
    setAccessToken('a-token');
    registerSessionHandlers({ refresh: async () => 'x', onSessionLost: () => {} });

    resetSession();

    expect(getAccessToken()).toBeNull();
    expect(getSessionHandlers()).toBeNull();
  });
});
