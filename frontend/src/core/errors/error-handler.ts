import axios, { AxiosError } from 'axios';
import {
  ApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  NetworkError,
} from './app-errors';

export function handleAxiosError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError(error instanceof Error ? error.message : 'An unexpected error occurred');
  }

  const { response, message } = error as AxiosError<{ error?: string; message?: string; details?: unknown }>;

  if (!response) {
    return new NetworkError(message);
  }

  const status = response.status;
  const data = response.data;
  const errorMsg = data?.error || data?.message || message || 'API request failed';

  switch (status) {
    case 400:
      return new ValidationError(errorMsg, data?.details);
    case 401:
      return new UnauthorizedError(errorMsg);
    case 403:
      return new ForbiddenError(errorMsg);
    case 404:
      return new NotFoundError(errorMsg);
    case 409:
      return new ConflictError(errorMsg);
    default:
      return new ApiError(errorMsg, status, data);
  }
}
