import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { QueryState } from '@/core/api/contracts/QueryState';

export const useDashboardStore = defineStore('dashboard', () => {
  const dashboardQueryState = ref<QueryState>('Idle');

  const setDashboardQueryState = (state: QueryState) => {
    dashboardQueryState.value = state;
  };

  const reset = () => {
    dashboardQueryState.value = 'Idle';
  };

  return {
    dashboardQueryState,
    setDashboardQueryState,
    reset,
  };
});
