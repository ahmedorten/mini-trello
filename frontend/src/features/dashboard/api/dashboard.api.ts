import type { ApiResult } from '@/core/api/ApiResult';
import type { DashboardResponse } from '@/features/statistics/types';

/**
 * @deprecated Use StatisticsApi from features/statistics/api/statistics.api.ts instead.
 * This class is retained for backward compatibility and will be removed in TASK-207 cleanup.
 */
export class DashboardApi {
  /** @deprecated Use StatisticsApi.getDashboard() */
  public static async getDashboard(): Promise<ApiResult<DashboardResponse>> {
    const { StatisticsApi } = await import('@/features/statistics/api/statistics.api');
    return StatisticsApi.getDashboard();
  }
}
