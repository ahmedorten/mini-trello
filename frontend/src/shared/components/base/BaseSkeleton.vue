<script setup lang="ts">
interface Props {
  variant?: 'text' | 'avatar' | 'card' | 'rectangular';
  radius?: 'sm' | 'md' | 'lg' | 'full';
}

withDefaults(defineProps<Props>(), {
  variant: 'text',
  radius: 'md',
});
</script>

<template>
  <div
    class="animate-pulse bg-gray-250 dark:bg-gray-800 duration-[1500ms]"
    :class="[
      variant === 'text' && 'h-4 w-full',
      variant === 'avatar' && 'h-9 w-9',
      variant === 'card' && 'h-32 w-full',
      variant === 'rectangular' && 'h-24 w-full',
      // Radius rules
      radius === 'sm' && 'rounded-md',
      radius === 'md' && 'rounded-lg',
      radius === 'lg' && 'rounded-xl',
      radius === 'full' && 'rounded-full',
      // Override avatar variant to always be circular
      variant === 'avatar' && 'rounded-full',
    ]"
  />
</template>
