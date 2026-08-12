import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { LabelResponse, CreateLabelRequest, UpdateLabelRequest } from '../types';

export class LabelApi {
  public static async listBoardLabels(boardId: string): Promise<ApiResult<LabelResponse[]>> {
    return apiClient.get<LabelResponse[]>(`/boards/${boardId}/labels`);
  }

  public static async createLabel(boardId: string, data: CreateLabelRequest): Promise<ApiResult<LabelResponse>> {
    return apiClient.post<LabelResponse>(`/boards/${boardId}/labels`, data);
  }

  public static async updateLabel(id: string, data: UpdateLabelRequest): Promise<ApiResult<LabelResponse>> {
    return apiClient.put<LabelResponse>(`/labels/${id}`, data);
  }

  public static async deleteLabel(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/labels/${id}`);
  }
}

export default LabelApi;
