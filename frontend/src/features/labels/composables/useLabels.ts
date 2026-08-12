import { computed } from 'vue';
import { useLabelStore } from '../stores/label.store';
import { LabelService } from '../services/label.service';
import type { CreateLabelRequest } from '../types';

export function useLabels() {
  const store = useLabelStore();

  const boardLabels = computed(() => store.boardLabels);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);

  const loadBoardLabels = async (boardId: string) => {
    await LabelService.fetchBoardLabels(boardId);
  };

  const createLabel = async (boardId: string, data: CreateLabelRequest) => {
    await LabelService.createLabel(boardId, data);
  };

  const deleteLabel = async (boardId: string, labelId: string) => {
    await LabelService.deleteLabel(boardId, labelId);
  };

  return {
    boardLabels,
    queryState,
    error,
    loadBoardLabels,
    createLabel,
    deleteLabel,
  };
}

export default useLabels;
