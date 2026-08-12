<script setup lang="ts">
interface Props {
  modelValue?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};
</script>

<template>
  <div class="flex flex-col space-y-1.5 w-full">
    <label v-if="label" class="text-xs font-semibold text-gray-600 uppercase tracking-wider">{{ label }}</label>
    <input
      type="date"
      :value="modelValue"
      @input="handleInput"
      :disabled="disabled"
      :min="min"
      :max="max"
      class="px-3.5 py-2 border rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:bg-gray-50 transition-all text-sm w-full bg-white text-gray-900 border-gray-200"
      :class="[
        error ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-250 hover:border-gray-300'
      ]"
    />
    <span v-if="error" class="text-xs text-red-600 font-medium">{{ error }}</span>
  </div>
</template>
