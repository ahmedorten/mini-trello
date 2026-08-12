import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { CardResponse } from '../types/dto/CardResponse';
import type { CreateCardRequest } from '../types/dto/CreateCardRequest';
import type { UpdateCardRequest } from '../types/dto/UpdateCardRequest';
import type { MoveCardRequest } from '../types/dto/MoveCardRequest';

export class CardApi {
  public static async listCards(columnId: string): Promise<ApiResult<CardResponse[]>> {
    return apiClient.get<CardResponse[]>(`/columns/${columnId}/cards`);
  }

  public static async getCard(id: string): Promise<ApiResult<CardResponse>> {
    return apiClient.get<CardResponse>(`/cards/${id}`);
  }

  public static async createCard(columnId: string, data: CreateCardRequest): Promise<ApiResult<CardResponse>> {
    return apiClient.post<CardResponse>(`/columns/${columnId}/cards`, data);
  }

  public static async updateCard(id: string, data: UpdateCardRequest): Promise<ApiResult<CardResponse>> {
    return apiClient.put<CardResponse>(`/cards/${id}`, data);
  }

  public static async deleteCard(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/cards/${id}`);
  }

  public static async moveCard(id: string, data: MoveCardRequest): Promise<ApiResult<CardResponse>> {
    return apiClient.post<CardResponse>(`/cards/${id}/move`, data);
  }

  public static async attachLabel(cardId: string, labelId: string): Promise<ApiResult<null>> {
    return apiClient.post<null>(`/cards/${cardId}/labels/${labelId}`);
  }

  public static async detachLabel(cardId: string, labelId: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/cards/${cardId}/labels/${labelId}`);
  }

  public static async searchCards(params?: unknown): Promise<ApiResult<unknown>> {
    return apiClient.get<unknown>('/cards/search', { params });
  }
}

export default CardApi;

