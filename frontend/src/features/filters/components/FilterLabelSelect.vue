<script setup lang="ts">
import { useFilterOptions } from '../composables/useFilterOptions';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value?: string): void;
}>();

const { labelOptions } = useFilterOptions();

const selectLabel = (id: string) => {
  emit('update:modelValue', props.modelValue === id ? undefined : id);
};
</script>

<template>
  <fieldset class="space-y-2">
    <legend class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Label</legend>
    <div class="flex flex-wrap gap-2 select-none">
      <button
        v-for="opt in labelOptions"
        :key="opt.value"
        type="button"
        @click="selectLabel(opt.value)"
        class="flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
        :class="[
          modelValue === opt.value
            ? 'border-brand-900 bg-brand-50 text-brand-900 shadow-xs'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
        ]"
      >
        <!-- ColorSwatch -->
        <span
          class="h-3 w-3 rounded-full flex-shrink-0"
          :style="{ backgroundColor: opt.color }"
          aria-hidden="true"
        />
        <span>{{ opt.label }}</span>
      </button>
    </div>
  </fieldset>
</template>
