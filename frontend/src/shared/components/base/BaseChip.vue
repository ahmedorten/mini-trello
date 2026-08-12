<script setup lang="ts">
interface Props {
  removable?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'remove'): void;
}>();
</script>

<template>
  <span
    class="inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700"
  >
    <slot />
    <button
      v-if="removable"
      type="button"
      @click="emit('remove')"
      class="group relative -mr-1 h-3.5 w-3.5 rounded-full hover:bg-gray-200 inline-flex items-center justify-center focus:outline-none"
    >
      <span class="sr-only">Remove</span>
      <svg viewBox="0 0 8 8" class="h-2 w-2 stroke-gray-500 group-hover:stroke-gray-700">
        <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
      </svg>
    </button>
  </span>
</template>
