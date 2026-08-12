<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';

interface Props {
  modelValue: string;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0 w-full max-w-md">
    <div class="relative w-full">
      <input
        type="text"
        :value="modelValue"
        @input="handleInput"
        placeholder="Search boards..."
        id="board-search"
        class="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm"
        aria-label="Search boards by name or description"
      />
      <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <MagnifyingGlassIcon class="h-4.5 w-4.5" />
      </div>
    </div>
  </div>
</template>
