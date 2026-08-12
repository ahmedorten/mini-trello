import { ref } from 'vue';
import type { Ref } from 'vue';
import { ApiError } from '@/core/errors/app-errors';
import type { ApiResult } from '@/core/api/ApiResult';

export function useApi<T, Args extends any[]>(
  apiCall: (...args: Args) => Promise<ApiResult<T>>
) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<ApiError | null>(null);

  const execute = async (...args: Args): Promise<ApiResult<T>> => {
    loading.value = true;
    error.value = null;
    try {
      const result = await apiCall(...args);
      if (result.success) {
        data.value = result.data;
      } else {
        error.value = result.error;
      }
      return result;
    } catch (e) {
      const err = e as ApiError;
      error.value = err;
      return { success: false, error: err };
    } finally {
      loading.value = false;
    }
  };

  return {
    data,
    loading,
    error,
    execute,
  };
}
