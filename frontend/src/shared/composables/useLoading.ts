import { computed } from 'vue';
import { useLoadingStore } from '../stores/loading.store';

export function useLoading() {
  const store = useLoadingStore();

  const activeRequests = computed(() => store.activeRequests);
  const globalLoading = computed(() => store.globalLoading);

  const startRequest = () => {
    store.startRequest();
  };

  const endRequest = () => {
    store.endRequest();
  };

  return {
    activeRequests,
    globalLoading,
    startRequest,
    endRequest,
  };
}

export default useLoading;
