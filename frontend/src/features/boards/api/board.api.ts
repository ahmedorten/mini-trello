import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { PagedResult } from '@/core/api/contracts/PagedResult';
import type { CreateBoardRequest } from '../types/dto/CreateBoardRequest';
import type { UpdateBoardRequest } from '../types/dto/UpdateBoardRequest';
import type { BoardResponse } from '../types/dto/BoardResponse';

export class BoardApi {
  public static async listBoards(params?: any): Promise<ApiResult<PagedResult<BoardResponse>>> {
    return apiClient.get<PagedResult<BoardResponse>>('/boards', { params });
  }

  public static async createBoard(data: CreateBoardRequest): Promise<ApiResult<BoardResponse>> {
    return apiClient.post<BoardResponse>('/boards', data);
  }

  public static async getBoard(id: string): Promise<ApiResult<BoardResponse>> {
    return apiClient.get<BoardResponse>(`/boards/${id}`);
  }

  public static async updateBoard(id: string, data: UpdateBoardRequest): Promise<ApiResult<BoardResponse>> {
    return apiClient.put<BoardResponse>(`/boards/${id}`, data);
  }

  public static async deleteBoard(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/boards/${id}`);
  }
}

export default BoardApi;
