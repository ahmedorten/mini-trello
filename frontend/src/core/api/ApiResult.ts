import { ApiError } from '../errors/app-errors';

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
