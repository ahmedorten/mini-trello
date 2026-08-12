<script setup lang="ts">
interface Props {
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'gray';
}

withDefaults(defineProps<Props>(), {
  variant: 'gray',
});
</script>

<template>
  <span
    class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
    :class="[
      variant === 'brand' && 'bg-brand-50 text-brand-700 ring-brand-700/10',
      variant === 'success' && 'bg-green-50 text-green-700 ring-green-600/10',
      variant === 'warning' && 'bg-yellow-50 text-yellow-850 ring-yellow-600/20',
      variant === 'danger' && 'bg-red-50 text-red-700 ring-red-600/10',
      variant === 'gray' && 'bg-gray-50 text-gray-600 ring-gray-500/10',
    ]"
  >
    <slot />
  </span>
</template>
