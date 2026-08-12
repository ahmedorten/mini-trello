<script setup lang="ts">
import BaseDatePicker from '@/shared/components/base/BaseDatePicker.vue';

defineProps<{
  dueBefore?: string;
  dueAfter?: string;
}>();

const emit = defineEmits<{
  (e: 'update:dueBefore', value?: string): void;
  (e: 'update:dueAfter', value?: string): void;
}>();

const onBeforeInput = (val: string) => {
  emit('update:dueBefore', val || undefined);
};

const onAfterInput = (val: string) => {
  emit('update:dueAfter', val || undefined);
};
</script>

<template>
  <fieldset class="space-y-4">
    <legend class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Due Date Range</legend>
    <div class="grid grid-cols-2 gap-4">
      <BaseDatePicker
        label="Due After"
        :model-value="dueAfter"
        @update:model-value="onAfterInput"
      />
      <BaseDatePicker
        label="Due Before"
        :model-value="dueBefore"
        @update:model-value="onBeforeInput"
      />
    </div>
  </fieldset>
</template>
