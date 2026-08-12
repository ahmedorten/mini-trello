import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { ActivityResponse } from '../types';

export class ActivityApi {
  public static async listActivities(cardId: string): Promise<ApiResult<ActivityResponse[]>> {
    return apiClient.get<ActivityResponse[]>(`/cards/${cardId}/activities`);
  }
}

export default ActivityApi;
