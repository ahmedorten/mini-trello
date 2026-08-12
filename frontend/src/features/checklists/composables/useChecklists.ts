import { computed } from 'vue';
import { useChecklistStore } from '../stores/checklist.store';
import { ChecklistService } from '../services/checklist.service';
import type { CreateChecklistRequest, UpdateChecklistRequest, CreateChecklistItemRequest, UpdateChecklistItemRequest } from '../types';

export function useChecklists() {
  const store = useChecklistStore();

  const checklists = computed(() => store.checklists);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);

  const loadChecklists = async (cardId: string) => {
    await ChecklistService.fetchChecklists(cardId);
  };

  const createChecklist = async (cardId: string, data: CreateChecklistRequest) => {
    await ChecklistService.createChecklist(cardId, data);
  };

  const editChecklist = async (cardId: string, id: string, data: UpdateChecklistRequest) => {
    await ChecklistService.updateChecklist(cardId, id, data);
  };

  const deleteChecklist = async (cardId: string, id: string) => {
    await ChecklistService.deleteChecklist(cardId, id);
  };

  const addChecklistItem = async (cardId: string, checklistId: string, data: CreateChecklistItemRequest) => {
    await ChecklistService.createChecklistItem(cardId, checklistId, data);
  };

  const editChecklistItem = async (cardId: string, id: string, data: UpdateChecklistItemRequest) => {
    await ChecklistService.updateChecklistItem(cardId, id, data);
  };

  const removeChecklistItem = async (cardId: string, id: string) => {
    await ChecklistService.deleteChecklistItem(cardId, id);
  };

  return {
    checklists,
    queryState,
    error,
    loadChecklists,
    createChecklist,
    editChecklist,
    deleteChecklist,
    addChecklistItem,
    editChecklistItem,
    removeChecklistItem,
  };
}

export default useChecklists;
