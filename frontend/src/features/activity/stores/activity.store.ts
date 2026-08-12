import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Activity } from '../types';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useActivityStore = defineStore('activity', () => {
  const activities = ref<Activity[]>([]);
  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);

  const setActivities = (list: Activity[]) => {
    activities.value = list;
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const reset = () => {
    activities.value = [];
    queryState.value = QueryState.Idle;
    error.value = null;
  };

  return {
    activities,
    queryState,
    error,
    setActivities,
    setQueryState,
    setError,
    reset,
  };
});

export default useActivityStore;
