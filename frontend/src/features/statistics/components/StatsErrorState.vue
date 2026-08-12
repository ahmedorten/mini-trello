<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

defineProps<{
  error?: string | null;
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
}>();
</script>

<template>
  <div class="text-center py-16 px-4 bg-white border border-red-150 rounded-2xl shadow-xs select-none max-w-xl mx-auto" aria-live="assertive">
    <div class="inline-flex p-3.5 bg-red-50 text-red-600 rounded-2xl mb-4">
      <ExclamationTriangleIcon class="h-8 w-8" aria-hidden="true" />
    </div>

    <h2 class="text-base font-bold text-gray-900">Failed to load statistics</h2>
    <p class="text-xs text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
      {{ error || 'An error occurred while fetching dashboard statistics. Please verify your connection and try again.' }}
    </p>

    <button
      type="button"
      @click="emit('retry')"
      class="mt-6 px-4.5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.98] transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
    >
      Retry Connection
    </button>
  </div>
</template>
