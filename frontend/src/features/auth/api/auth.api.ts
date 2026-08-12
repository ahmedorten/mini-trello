import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { LoginRequest } from '../types/dto/LoginRequest';
import type { LoginResponse } from '../types/dto/LoginResponse';
import type { RegisterRequest } from '../types/dto/RegisterRequest';
import type { UserProfile } from '../types/models/UserProfile';

export class AuthApi {
  public static async login(credentials: LoginRequest): Promise<ApiResult<LoginResponse>> {
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  }

  public static async register(userData: RegisterRequest): Promise<ApiResult<UserProfile>> {
    return apiClient.post<UserProfile>('/auth/register', userData);
  }

  public static async getMe(): Promise<ApiResult<UserProfile>> {
    return apiClient.get<UserProfile>('/auth/me');
  }
}

export default AuthApi;
