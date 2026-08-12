import { ref } from 'vue';
import type { Ref } from 'vue';

export function useAsyncState<T>(
  asyncTask: () => Promise<T>,
  initialState: T
) {
  const state = ref(initialState) as Ref<T>;
  const loading = ref(false);
  const error = ref<unknown>(null);

  const execute = async (): Promise<T | null> => {
    loading.value = true;
    error.value = null;
    try {
      const res = await asyncTask();
      state.value = res;
      return res;
    } catch (e) {
      error.value = e;
      return null;
    } finally {
      loading.value = false;
    }
  };

  return {
    state,
    loading,
    error,
    execute,
  };
}
