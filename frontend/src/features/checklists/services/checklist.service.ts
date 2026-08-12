import { ChecklistApi } from '../api/checklist.api';
import { useChecklistStore } from '../stores/checklist.store';
import { CardRefreshService } from '@/features/cards/services/CardRefreshService';
import { QueryState } from '@/core/api/contracts/QueryState';
import type { CreateChecklistRequest, UpdateChecklistRequest, CreateChecklistItemRequest, UpdateChecklistItemRequest } from '../types';

export class ChecklistService {
  public static async fetchChecklists(cardId: string): Promise<void> {
    const store = useChecklistStore();
    store.setQueryState(QueryState.Loading);
    store.setError(null);

    const result = await ChecklistApi.listChecklists(cardId);
    if (result.success) {
      // Map ChecklistResponse to Checklist model, making sure checklistItems is an array
      const mapped = result.data.map(c => ({
        ...c,
        checklistItems: c.checklistItems || [],
      }));
      store.setChecklists(mapped);
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async createChecklist(cardId: string, data: CreateChecklistRequest): Promise<void> {
    const store = useChecklistStore();
    const result = await ChecklistApi.createChecklist(cardId, data);
    if (result.success) {
      store.addChecklist({
        ...result.data,
        checklistItems: [],
      });
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }

  public static async updateChecklist(cardId: string, id: string, data: UpdateChecklistRequest): Promise<void> {
    const result = await ChecklistApi.updateChecklist(id, data);
    if (result.success) {
      await this.fetchChecklists(cardId);
    } else {
      throw result.error;
    }
  }

  public static async deleteChecklist(cardId: string, id: string): Promise<void> {
    const store = useChecklistStore();
    const result = await ChecklistApi.deleteChecklist(id);
    if (result.success) {
      store.removeChecklist(id);
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }

  public static async createChecklistItem(cardId: string, checklistId: string, data: CreateChecklistItemRequest): Promise<void> {
    const result = await ChecklistApi.createChecklistItem(checklistId, data);
    if (result.success) {
      await this.fetchChecklists(cardId);
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }

  public static async updateChecklistItem(cardId: string, id: string, data: UpdateChecklistItemRequest): Promise<void> {
    const result = await ChecklistApi.updateChecklistItem(id, data);
    if (result.success) {
      await this.fetchChecklists(cardId);
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }

  public static async deleteChecklistItem(cardId: string, id: string): Promise<void> {
    const result = await ChecklistApi.deleteChecklistItem(id);
    if (result.success) {
      await this.fetchChecklists(cardId);
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }
}

export default ChecklistService;
