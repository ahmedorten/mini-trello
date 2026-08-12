<script setup lang="ts">
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';

interface Props {
  message?: string;
}

withDefaults(defineProps<Props>(), {
  message: 'Failed to load boards. Please check your network connection.',
});

defineEmits<{
  (e: 'retry'): void;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center p-8 bg-red-50 border border-red-200 rounded-3xl min-h-[300px]" role="alert">
    <div class="p-3 bg-red-100 text-red-600 rounded-2xl animate-bounce">
      <ExclamationTriangleIcon class="h-8 w-8" aria-hidden="true" />
    </div>

    <h3 class="font-bold text-red-900 mt-4 text-base">An error occurred</h3>
    <p class="text-xs text-red-700 max-w-sm mt-1.5 leading-relaxed">
      {{ message }}
    </p>

    <BaseButton
      @click="$emit('retry')"
      variant="secondary"
      class="mt-6 flex items-center space-x-1.5 border border-red-200 hover:bg-red-100 text-red-800 transition-colors shadow-sm"
      aria-label="Retry loading boards"
    >
      <ArrowPathIcon class="h-4 w-4" />
      <span>Retry Load</span>
    </BaseButton>
  </div>
</template>
