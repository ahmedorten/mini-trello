import axios, { AxiosError, type AxiosInstance } from 'axios';

// Empty VITE_API_BASE_URL means "use the Vite dev proxy", which forwards
// /api to the backend on port 3000. Deployed builds set an absolute URL.
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

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
