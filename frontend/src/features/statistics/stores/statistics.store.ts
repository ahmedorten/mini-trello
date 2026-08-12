import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DashboardResponse } from '../types';
import type { QueryState } from '@/core/api/contracts/QueryState';

export const useStatisticsStore = defineStore('statistics', () => {
  const stats = ref<DashboardResponse | null>(null);
  const queryState = ref<QueryState>('Idle');
  const error = ref<string | null>(null);
  const lastRefreshedAt = ref<string | null>(null);

  const setStats = (data: DashboardResponse) => {
    stats.value = data;
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const setLastRefreshedAt = (ts: string) => {
    lastRefreshedAt.value = ts;
  };

  const reset = () => {
    stats.value = null;
    queryState.value = 'Idle';
    error.value = null;
    lastRefreshedAt.value = null;
  };

  return {
    stats,
    queryState,
    error,
    lastRefreshedAt,
    setStats,
    setQueryState,
    setError,
    setLastRefreshedAt,
    reset,
  };
});

export default useStatisticsStore;
