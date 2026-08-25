import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getSessionHandlers } from './session';

// Empty VITE_API_BASE_URL means "use the Vite dev proxy", which forwards
// /api to the backend on port 3000. Deployed builds set an absolute URL.
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  // Required so the httpOnly crm_refresh cookie is sent. Same-origin in dev via
  // the Vite proxy, cross-origin in a deployment with an absolute base URL.
  withCredentials: true,
});

/**
 * No interceptors. Used by login, refresh, and logout: those must not trigger
 * the 401-refresh logic, or a failed refresh would refresh, recursively.
 */
export const rawClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _authRetried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || error.response?.status !== 401) {
      // 403 lands here and is re-thrown untouched. A missing permission is not
      // a stale token: refreshing would succeed and change nothing, and
      // logging out would trap the user in a sign-in loop.
      return Promise.reject(error);
    }

    const config = error.config as RetriableConfig | undefined;
    const handlers = getSessionHandlers();

    // Retry exactly once. Without this flag a permanently-401 endpoint would
    // refresh and replay forever.
    if (!config || config._authRetried || !handlers) {
      handlers?.onSessionLost();
      return Promise.reject(error);
    }

    config._authRetried = true;

    const token = await handlers.refresh();

    if (!token) {
      handlers.onSessionLost();
      return Promise.reject(error);
    }

    config.headers.Authorization = `Bearer ${token}`;

    return apiClient.request(config);
  },
);

/** Error envelope produced by the API's AllExceptionsFilter (Story 02). */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
}

/** Normalizes any thrown value into a single human-readable message. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;

    if (error.response?.status === 403) {
      const detail = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;

      return detail
        ? `You do not have permission to do this (${detail}).`
        : 'You do not have permission to do this.';
    }

    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join(', ') : body.message;
    }

    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Is the API running?';
    }

    if (!error.response) {
      return 'Cannot reach the API. Is it running on port 3000?';
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'Unexpected error';
}
