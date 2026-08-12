<script setup lang="ts">
interface Props {
  text: string;
  position?: 'top' | 'bottom' | 'start' | 'end';
}

withDefaults(defineProps<Props>(), {
  position: 'top',
});
</script>

<template>
  <div class="relative group inline-block">
    <slot />
    <div
      class="absolute z-50 pointer-events-none whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
      :class="[
        position === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        position === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-2',
        position === 'end' && 'start-full top-1/2 -translate-y-1/2 ms-2',
        position === 'start' && 'end-full top-1/2 -translate-y-1/2 me-2',
      ]"
    >
      {{ text }}
    </div>
  </div>
</template>
