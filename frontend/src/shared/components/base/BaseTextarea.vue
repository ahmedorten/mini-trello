<script setup lang="ts">
interface Props {
  modelValue: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  rows?: number;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  rows: 3,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};
</script>

<template>
  <div class="flex flex-col space-y-1 w-full">
    <label v-if="label" class="text-sm font-medium text-gray-700">{{ label }}</label>
    <textarea
      :value="modelValue"
      @input="handleInput"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      class="px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:bg-gray-50 transition-all text-sm"
      :class="[
        error ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-brand-500 focus:border-brand-500'
      ]"
    />
    <span v-if="error" class="text-xs text-red-600 font-medium">{{ error }}</span>
  </div>
</template>
