<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/20/solid';

defineProps<{
  label: string;
  value: string;
}>();

const emit = defineEmits<{
  (e: 'remove'): void;
}>();
</script>

<template>
  <span class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-800 border border-brand-100 shadow-xs select-none">
    <span class="text-brand-600 font-medium">{{ label }}:</span>
    <span class="text-brand-900 font-bold truncate max-w-[120px]">{{ value }}</span>
    <button
      type="button"
      @click="emit('remove')"
      class="p-0.5 rounded-full text-brand-500 hover:text-brand-800 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all"
      :aria-label="`Remove ${label} filter`"
    >
      <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
</template>
