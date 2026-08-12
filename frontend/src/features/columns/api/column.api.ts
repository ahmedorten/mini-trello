import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { CreateColumnRequest } from '../types/dto/CreateColumnRequest';
import type { UpdateColumnRequest } from '../types/dto/UpdateColumnRequest';
import type { ColumnResponse } from '../types/dto/ColumnResponse';

export class ColumnApi {
  public static async listColumns(boardId: string): Promise<ApiResult<ColumnResponse[]>> {
    return apiClient.get<ColumnResponse[]>(`/boards/${boardId}/columns`);
  }

  public static async createColumn(boardId: string, data: CreateColumnRequest): Promise<ApiResult<ColumnResponse>> {
    return apiClient.post<ColumnResponse>(`/boards/${boardId}/columns`, data);
  }

  public static async updateColumn(id: string, data: UpdateColumnRequest): Promise<ApiResult<ColumnResponse>> {
    return apiClient.put<ColumnResponse>(`/columns/${id}`, data);
  }

  public static async deleteColumn(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/columns/${id}`);
  }
}

export default ColumnApi;
