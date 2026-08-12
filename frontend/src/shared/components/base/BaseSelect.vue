<script setup lang="ts">
interface Option {
  value: string | number;
  label: string;
}

interface Props {
  modelValue: string | number;
  options: Option[];
  label?: string;
  error?: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
};
</script>

<template>
  <div class="flex flex-col space-y-1 w-full">
    <label v-if="label" class="text-sm font-medium text-gray-700">{{ label }}</label>
    <select
      :value="modelValue"
      @change="handleChange"
      :disabled="disabled"
      class="px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:bg-gray-50 bg-white transition-all text-sm"
      :class="[
        error ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-brand-500 focus:border-brand-500'
      ]"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <span v-if="error" class="text-xs text-red-600 font-medium">{{ error }}</span>
  </div>
</template>
