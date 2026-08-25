import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient, toErrorMessage } from './client';

function makeAxiosError(overrides: Partial<AxiosError> = {}): AxiosError {
  const error = new AxiosError('Request failed', overrides.code);
  Object.assign(error, overrides);
  return error;
}

describe('apiClient', () => {
  it('falls back to /api when VITE_API_BASE_URL is empty', () => {
    expect(apiClient.defaults.baseURL).toBe('/api');
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
});
