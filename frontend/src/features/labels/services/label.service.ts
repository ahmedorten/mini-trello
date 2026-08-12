import { LabelApi } from '../api/label.api';
import { useLabelStore } from '../stores/label.store';
import { QueryState } from '@/core/api/contracts/QueryState';
import type { CreateLabelRequest, UpdateLabelRequest } from '../types';

export class LabelService {
  public static async fetchBoardLabels(boardId: string): Promise<void> {
    const store = useLabelStore();
    store.setQueryState(QueryState.Loading);
    store.setError(null);

    const result = await LabelApi.listBoardLabels(boardId);
    if (result.success) {
      store.setBoardLabels(result.data);
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async createLabel(boardId: string, data: CreateLabelRequest): Promise<void> {
    const result = await LabelApi.createLabel(boardId, data);
    if (result.success) {
      await this.fetchBoardLabels(boardId);
    } else {
      throw result.error;
    }
  }

  public static async updateLabel(boardId: string, id: string, data: UpdateLabelRequest): Promise<void> {
    const result = await LabelApi.updateLabel(id, data);
    if (result.success) {
      await this.fetchBoardLabels(boardId);
    } else {
      throw result.error;
    }
  }

  public static async deleteLabel(boardId: string, id: string): Promise<void> {
    const result = await LabelApi.deleteLabel(id);
    if (result.success) {
      await this.fetchBoardLabels(boardId);
    } else {
      throw result.error;
    }
  }
}

export default LabelService;
