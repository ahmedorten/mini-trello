import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Checklist } from '../types';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useChecklistStore = defineStore('checklist', () => {
  const checklists = ref<Checklist[]>([]);
  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);

  const setChecklists = (list: Checklist[]) => {
    checklists.value = list;
  };

  const addChecklist = (checklist: Checklist) => {
    checklists.value = [...checklists.value, checklist];
  };

  const removeChecklist = (id: string) => {
    checklists.value = checklists.value.filter(c => c.id !== id);
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const reset = () => {
    checklists.value = [];
    queryState.value = QueryState.Idle;
    error.value = null;
  };

  return {
    checklists,
    queryState,
    error,
    setChecklists,
    addChecklist,
    removeChecklist,
    setQueryState,
    setError,
    reset,
  };
});

export default useChecklistStore;
