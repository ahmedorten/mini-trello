<script setup lang="ts">
import type { CardPriority } from '@/features/cards/types/models/CardState';
import { useFilterOptions } from '../composables/useFilterOptions';

const props = defineProps<{
  modelValue?: CardPriority;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value?: CardPriority): void;
}>();

const { priorityOptions } = useFilterOptions();

const selectPriority = (val?: CardPriority) => {
  emit('update:modelValue', props.modelValue === val ? undefined : val);
};
</script>

<template>
  <fieldset class="space-y-2">
    <legend class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Priority</legend>
    <div class="flex flex-wrap gap-2 select-none">
      <button
        v-for="opt in priorityOptions"
        :key="opt.value"
        type="button"
        @click="selectPriority(opt.value)"
        class="px-3.5 py-2 text-xs font-bold rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
        :class="[
          modelValue === opt.value
            ? 'bg-brand-900 border-brand-900 text-white shadow-sm'
            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        ]"
      >
        {{ opt.value }}
      </button>
    </div>
  </fieldset>
</template>
