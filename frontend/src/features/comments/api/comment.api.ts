import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { CommentResponse, CreateCommentRequest, UpdateCommentRequest } from '../types';

export class CommentApi {
  public static async listComments(cardId: string): Promise<ApiResult<CommentResponse[]>> {
    return apiClient.get<CommentResponse[]>(`/cards/${cardId}/comments`);
  }

  public static async createComment(cardId: string, data: CreateCommentRequest): Promise<ApiResult<CommentResponse>> {
    return apiClient.post<CommentResponse>(`/cards/${cardId}/comments`, data);
  }

  public static async updateComment(id: string, data: UpdateCommentRequest): Promise<ApiResult<CommentResponse>> {
    return apiClient.put<CommentResponse>(`/comments/${id}`, data);
  }

  public static async deleteComment(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/comments/${id}`);
  }
}

export default CommentApi;
