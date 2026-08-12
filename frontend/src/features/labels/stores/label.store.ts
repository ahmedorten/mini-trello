import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Label } from '../types';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useLabelStore = defineStore('label', () => {
  const boardLabels = ref<Label[]>([]);
  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);

  const setBoardLabels = (list: Label[]) => {
    boardLabels.value = list;
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const reset = () => {
    boardLabels.value = [];
    queryState.value = QueryState.Idle;
    error.value = null;
  };

  return {
    boardLabels,
    queryState,
    error,
    setBoardLabels,
    setQueryState,
    setError,
    reset,
  };
});
export default useLabelStore;
