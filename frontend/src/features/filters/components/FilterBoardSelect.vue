<script setup lang="ts">
import { useFilterOptions } from '../composables/useFilterOptions';
import BaseSelect from '@/shared/components/base/BaseSelect.vue';

defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value?: string): void;
}>();

const { boardOptions } = useFilterOptions();

const onChange = (val: string) => {
  emit('update:modelValue', val === '' ? undefined : val);
};
</script>

<template>
  <div class="space-y-1.5 w-full">
    <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Scope to Board</label>
    <BaseSelect
      :model-value="modelValue || ''"
      @update:model-value="onChange"
      :options="[{ value: '', label: 'All Boards' }, ...boardOptions]"
      class="w-full"
    />
  </div>
</template>
