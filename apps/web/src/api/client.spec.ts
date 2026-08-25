import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { apiClient, toErrorMessage } from './client';
import { registerSessionHandlers, resetSession, setAccessToken } from './session';

function makeAxiosError(overrides: Partial<AxiosError> = {}): AxiosError {
  const error = new AxiosError('Request failed', overrides.code);
  Object.assign(error, overrides);
  return error;
}

function makeResponse(status: number, data: unknown, config: InternalAxiosRequestConfig): AxiosResponse {
  return { data, status, statusText: '', headers: new AxiosHeaders(), config };
}

function makeFailure(status: number, data: unknown, config: InternalAxiosRequestConfig): AxiosError {
  const error = new AxiosError('Request failed', undefined, config);
  error.response = makeResponse(status, data, config);
  return error;
}

describe('apiClient', () => {
  it('falls back to /api when VITE_API_BASE_URL is empty', () => {
    expect(apiClient.defaults.baseURL).toBe('/api');
  });
});

describe('apiClient interceptors', () => {
  const originalAdapter = apiClient.defaults.adapter;
  let adapter: ReturnType<typeof vi.fn<[InternalAxiosRequestConfig], Promise<AxiosResponse>>>;
  let refresh: ReturnType<typeof vi.fn<[], Promise<string | null>>>;
  let onSessionLost: ReturnType<typeof vi.fn<[], void>>;

  beforeEach(() => {
    adapter = vi.fn();
    apiClient.defaults.adapter = adapter;
    refresh = vi.fn();
    onSessionLost = vi.fn();
    registerSessionHandlers({ refresh, onSessionLost });
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    resetSession();
  });

  it('adds the Authorization header when a token is set', async () => {
    setAccessToken('a-token');
    adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
      Promise.resolve(makeResponse(200, { ok: true }, config)),
    );

    await apiClient.get('/whoami');

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig;
    expect(config.headers.get('Authorization')).toBe('Bearer a-token');
  });

  it('omits the Authorization header entirely when no token is set', async () => {
    adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
      Promise.resolve(makeResponse(200, { ok: true }, config)),
    );

    await apiClient.get('/whoami');

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig;
    expect(config.headers.has('Authorization')).toBe(false);
  });

  it('refreshes once on a 401 and replays the original request with the new token', async () => {
    refresh.mockResolvedValue('fresh-token');
    let call = 0;
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => {
      call += 1;

      if (call === 1) {
        return Promise.reject(makeFailure(401, { message: 'Unauthorized' }, config));
      }

      return Promise.resolve(makeResponse(200, { ok: true }, config));
    });

    const response = await apiClient.get('/protected');

    expect(response.data).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onSessionLost).not.toHaveBeenCalled();
    const replayedConfig = adapter.mock.calls[1][0] as InternalAxiosRequestConfig;
    expect(replayedConfig.headers.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('calls onSessionLost and rejects when the refresh resolves null', async () => {
    refresh.mockResolvedValue(null);
    adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
      Promise.reject(makeFailure(401, { message: 'Unauthorized' }, config)),
    );

    await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(AxiosError);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it('does not refresh again once a request has already been retried', async () => {
    refresh.mockResolvedValue('fresh-token');
    adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
      Promise.reject(makeFailure(401, { message: 'Unauthorized' }, config)),
    );

    await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(AxiosError);

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it('never refreshes or signs out on a 403, and rejects with the original error', async () => {
    adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
      Promise.reject(makeFailure(403, { message: 'Forbidden' }, config)),
    );

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      response: { status: 403 },
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

describe('toErrorMessage', () => {
  it('returns a string message from the response body', () => {
    const error = makeAxiosError({
      response: {
        data: { statusCode: 400, message: 'Bad request', error: 'Bad Request', path: '/x', timestamp: '' },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
      },
    });

    expect(toErrorMessage(error)).toBe('Bad request');
  });

  it('joins a string[] message from ValidationPipe', () => {
    const error = makeAxiosError({
      response: {
        data: {
          statusCode: 400,
          message: ['field a is required', 'field b is required'],
          error: 'Bad Request',
          path: '/x',
          timestamp: '',
        },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
      },
    });

    expect(toErrorMessage(error)).toBe('field a is required, field b is required');
  });

  it('returns a connectivity message when there is no response', () => {
    const error = makeAxiosError({ response: undefined });

    expect(toErrorMessage(error)).toBe('Cannot reach the API. Is it running on port 3000?');
  });

  it('returns a timeout message for ECONNABORTED', () => {
    const error = makeAxiosError({ code: 'ECONNABORTED', response: undefined });
    error.code = 'ECONNABORTED';

    expect(toErrorMessage(error)).toBe('The request timed out. Is the API running?');
  });

  it('returns the message from a plain Error', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns a generic message for a non-Error throw', () => {
    expect(toErrorMessage('boom')).toBe('Unexpected error');
  });

  it('renders a 403 with detail as a permission message', () => {
    const error = makeAxiosError({
      response: {
        data: {
          statusCode: 403,
          message: 'users:write required',
          error: 'Forbidden',
          path: '/x',
          timestamp: '',
        },
        status: 403,
        statusText: 'Forbidden',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
      },
    });

    expect(toErrorMessage(error)).toBe('You do not have permission to do this (users:write required).');
  });

  it('renders a 403 with no detail as a generic permission message', () => {
    const error = makeAxiosError({
      response: {
        data: { statusCode: 403, message: '', error: 'Forbidden', path: '/x', timestamp: '' },
        status: 403,
        statusText: 'Forbidden',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
      },
    });

    expect(toErrorMessage(error)).toBe('You do not have permission to do this.');
  });
});
