<script setup lang="ts">
import { useFilterOptions } from '../composables/useFilterOptions';

const props = defineProps<{
  modelValue?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value?: boolean): void;
}>();

const { completionOptions } = useFilterOptions();

const selectValue = (val: string) => {
  if (val === 'all') {
    emit('update:modelValue', undefined);
  } else if (val === 'active') {
    emit('update:modelValue', false);
  } else if (val === 'archived') {
    emit('update:modelValue', true);
  }
};

const activeValue = computed(() => {
  if (props.modelValue === undefined) return 'all';
  return props.modelValue ? 'archived' : 'active';
});
import { computed } from 'vue';
</script>

<template>
  <fieldset class="space-y-2">
    <legend class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Completion Status</legend>
    <div class="flex rounded-xl bg-gray-100 p-1 select-none">
      <button
        v-for="opt in completionOptions"
        :key="opt.value"
        type="button"
        @click="selectValue(opt.value)"
        class="flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
        :class="[
          activeValue === opt.value
            ? 'bg-white text-gray-900 shadow-xs'
            : 'text-gray-500 hover:text-gray-900'
        ]"
      >
        {{ opt.label }}
      </button>
    </div>
  </fieldset>
</template>
