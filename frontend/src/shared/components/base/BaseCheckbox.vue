<script setup lang="ts">
interface Props {
  modelValue: boolean;
  label?: string;
  disabled?: boolean;
  error?: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.checked);
};
</script>

<template>
  <div class="flex flex-col space-y-1">
    <label class="inline-flex items-center space-x-2 cursor-pointer select-none">
      <input
        type="checkbox"
        :checked="modelValue"
        @change="handleChange"
        :disabled="disabled"
        class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <span v-if="label" class="text-sm text-gray-700 font-medium" :class="{ 'opacity-50': disabled }">{{ label }}</span>
    </label>
    <span v-if="error" class="text-xs text-red-600 font-medium">{{ error }}</span>
  </div>
</template>
