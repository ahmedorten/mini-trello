import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { PagedResult } from '@/core/api/contracts/PagedResult';
import type { CardResponse } from '@/features/cards/types/dto/CardResponse';
import type { BoardResponse } from '@/features/boards/types/dto/BoardResponse';

export interface CardSearchParams {
  q?: string;
  boardId?: string;
  columnId?: string;
  priority?: string;
  labelId?: string;
  hasAttachments?: boolean;
  hasComments?: boolean;
  hasChecklist?: boolean;
  dueBefore?: string;
  dueAfter?: string;
  isArchived?: boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface BoardSearchParams {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export class SearchApi {
  /**
   * Search cards with full filter matrix.
   * Accepts an AbortSignal for request cancellation.
   */
  public static async searchCards(
    params?: CardSearchParams,
    signal?: AbortSignal
  ): Promise<ApiResult<PagedResult<CardResponse>>> {
    return apiClient.get<PagedResult<CardResponse>>('/cards/search', {
      params,
      signal,
    });
  }

  /**
   * Search boards by name.
   * Accepts an AbortSignal for request cancellation.
   */
  public static async searchBoards(
    params?: BoardSearchParams,
    signal?: AbortSignal
  ): Promise<ApiResult<PagedResult<BoardResponse>>> {
    return apiClient.get<PagedResult<BoardResponse>>('/boards', {
      params,
      signal,
    });
  }
}

export default SearchApi;
