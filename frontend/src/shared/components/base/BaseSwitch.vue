<script setup lang="ts">
interface Props {
  modelValue: boolean;
  label?: string;
  disabled?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const toggle = (checked: boolean) => {
  emit('update:modelValue', checked);
};
</script>

<template>
  <div class="flex items-center space-x-3">
    <button
      type="button"
      :disabled="disabled"
      @click="toggle(!modelValue)"
      class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      :class="modelValue ? 'bg-brand-600' : 'bg-gray-200'"
    >
      <span
        aria-hidden="true"
        class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
    <span v-if="label" class="text-sm font-medium text-gray-700" :class="{ 'opacity-50': disabled }">
      {{ label }}
    </span>
  </div>
</template>
