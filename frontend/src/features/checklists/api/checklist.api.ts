import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type {
  ChecklistResponse,
  CreateChecklistRequest,
  UpdateChecklistRequest,
  ChecklistItemResponse,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
} from '../types';

export class ChecklistApi {
  public static async listChecklists(cardId: string): Promise<ApiResult<ChecklistResponse[]>> {
    return apiClient.get<ChecklistResponse[]>(`/cards/${cardId}/checklists`);
  }

  public static async createChecklist(cardId: string, data: CreateChecklistRequest): Promise<ApiResult<ChecklistResponse>> {
    return apiClient.post<ChecklistResponse>(`/cards/${cardId}/checklists`, data);
  }

  public static async updateChecklist(id: string, data: UpdateChecklistRequest): Promise<ApiResult<ChecklistResponse>> {
    return apiClient.put<ChecklistResponse>(`/checklists/${id}`, data);
  }

  public static async deleteChecklist(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/checklists/${id}`);
  }

  public static async createChecklistItem(checklistId: string, data: CreateChecklistItemRequest): Promise<ApiResult<ChecklistItemResponse>> {
    return apiClient.post<ChecklistItemResponse>(`/checklists/${checklistId}/items`, data);
  }

  public static async updateChecklistItem(id: string, data: UpdateChecklistItemRequest): Promise<ApiResult<ChecklistItemResponse>> {
    return apiClient.put<ChecklistItemResponse>(`/checklist-items/${id}`, data);
  }

  public static async deleteChecklistItem(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/checklist-items/${id}`);
  }
}

export default ChecklistApi;
