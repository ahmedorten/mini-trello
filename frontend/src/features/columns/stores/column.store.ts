import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Column } from '../types/models/Column';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useColumnStore = defineStore('column', () => {
  const columns = ref<Column[]>([]);
  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);

  const setColumns = (list: Column[]) => {
    columns.value = list;
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const reset = () => {
    columns.value = [];
    queryState.value = QueryState.Idle;
    error.value = null;
  };

  return {
    columns,
    queryState,
    error,
    setColumns,
    setQueryState,
    setError,
    reset,
  };
});
