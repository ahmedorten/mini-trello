import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useLoadingStore = defineStore('loading', () => {
  const activeRequests = ref(0);
  const globalLoading = ref(false);

  const startRequest = () => {
    activeRequests.value++;
  };

  const endRequest = () => {
    activeRequests.value = Math.max(0, activeRequests.value - 1);
  };

  const setGlobalLoading = (isLoading: boolean) => {
    globalLoading.value = isLoading;
  };

  const reset = () => {
    activeRequests.value = 0;
    globalLoading.value = false;
  };

  return {
    activeRequests,
    globalLoading,
    startRequest,
    endRequest,
    setGlobalLoading,
    reset,
  };
});

export default useLoadingStore;
