import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { DashboardResponse } from '../types';

export class StatisticsApi {
  public static async getDashboard(): Promise<ApiResult<DashboardResponse>> {
    return apiClient.get<DashboardResponse>('/dashboard');
  }
}

export default StatisticsApi;
