import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchHealth, type HealthResponse } from '@/api/health';
import { toErrorMessage } from '@/api/client';

export const useHealthStore = defineStore('health', () => {
  const data = ref<HealthResponse | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastCheckedAt = ref<string | null>(null);

  const isHealthy = computed(() => data.value?.status === 'ok');
  const isDatabaseUp = computed(() => data.value?.database.status === 'up');

  async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      data.value = await fetchHealth();
    } catch (caught) {
      data.value = null;
      error.value = toErrorMessage(caught);
    } finally {
      isLoading.value = false;
      lastCheckedAt.value = new Date().toISOString();
    }
  }

  return { data, isLoading, error, lastCheckedAt, isHealthy, isDatabaseUp, load };
});
