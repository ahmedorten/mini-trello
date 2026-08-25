import { apiClient, rawClient } from './client';

/** Mirrors CurrentUserDto in apps/api/src/auth/dto/current-user.dto.ts */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  departmentId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}

/** Mirrors LoginResponseDto. There is deliberately no refreshToken field: it
 *  lives only in the httpOnly cookie and JavaScript must not be able to read it. */
export interface LoginResponse {
  accessToken: string;
  expiresInSeconds: number;
  tokenType: string;
}

/**
 * login, refresh, and logout all use `rawClient`, NOT `apiClient`.
 * apiClient's response interceptor reacts to 401 by refreshing — pointing it at
 * the refresh endpoint itself would recurse.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await rawClient.post<LoginResponse>('/auth/login', { email, password });

  return response.data;
}

export async function refreshSession(): Promise<LoginResponse> {
  const response = await rawClient.post<LoginResponse>('/auth/refresh');

  return response.data;
}

export async function logout(): Promise<void> {
  await rawClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me');

  return response.data;
}
