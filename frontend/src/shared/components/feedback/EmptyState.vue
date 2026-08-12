<script setup lang="ts">
import BaseIcon from '@/shared/components/base/BaseIcon.vue';

withDefaults(defineProps<{
  icon?: string;
  title: string;
  description: string;
}>(), {
  icon: 'archive-box',
});
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-gray-250 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/10 transition-colors duration-200">
    <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-450 dark:text-gray-400 mb-4 shadow-2xs">
      <BaseIcon :name="icon" size="lg" />
    </div>

    <h3 class="text-sm font-semibold text-gray-950 dark:text-gray-50">
      {{ title }}
    </h3>
    
    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
      {{ description }}
    </p>

    <!-- Action Slot -->
    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>
