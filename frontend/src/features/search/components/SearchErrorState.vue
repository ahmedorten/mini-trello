<script setup lang="ts">
import { ExclamationTriangleIcon, WifiIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  error?: string | null;
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
}>();

const isNetworkError = computed(() => {
  return props.error?.toLowerCase().includes('network') || props.error?.toLowerCase().includes('connect');
});
import { computed } from 'vue';
</script>

<template>
  <div class="text-center py-10 px-4 bg-white border border-red-150 rounded-2xl shadow-xs select-none" aria-live="assertive">
    <div class="inline-flex p-3.5 rounded-2xl mb-4" :class="isNetworkError ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'">
      <component :is="isNetworkError ? WifiIcon : ExclamationTriangleIcon" class="h-8 w-8" aria-hidden="true" />
    </div>

    <h3 class="text-sm font-bold text-gray-900">
      {{ isNetworkError ? 'Connection lost' : 'Search failed' }}
    </h3>
    <p class="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
      {{ error || 'Something went wrong while searching. Please try again.' }}
    </p>

    <button
      type="button"
      @click="emit('retry')"
      class="mt-5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.98] transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
    >
      Try again
    </button>
  </div>
</template>
