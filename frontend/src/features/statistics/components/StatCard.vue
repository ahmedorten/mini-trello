<script setup lang="ts">
import { computed } from 'vue';
import StatCardSkeleton from './StatCardSkeleton.vue';

const props = defineProps<{
  label: string;
  value: string | number;
  subLabel?: string;
  color?: string; // e.g. bg-brand-50 text-brand-600
  loading?: boolean;
}>();

// Map text color to top border accent class
const accentBorderClass = computed(() => {
  const col = props.color || '';
  if (col.includes('brand')) return 'border-t-brand-500 dark:border-t-brand-400';
  if (col.includes('indigo')) return 'border-t-indigo-500 dark:border-t-indigo-400';
  if (col.includes('emerald')) return 'border-t-emerald-500 dark:border-t-emerald-400';
  return 'border-t-gray-400 dark:border-t-gray-500';
});

// Map colors to a beautiful theme-aware gradient for the icon container
const iconContainerClass = computed(() => {
  const col = props.color || '';
  if (col.includes('brand')) {
    return 'bg-gradient-to-br from-brand-50 to-brand-100/60 dark:from-brand-950/40 dark:to-brand-900/20 text-brand-600 dark:text-brand-450';
  }
  if (col.includes('indigo')) {
    return 'bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-950/40 dark:to-indigo-900/20 text-indigo-600 dark:text-indigo-400';
  }
  if (col.includes('emerald')) {
    return 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20 text-emerald-600 dark:text-emerald-400';
  }
  return 'bg-gradient-to-br from-gray-50 to-gray-100/60 dark:from-gray-800/40 dark:to-gray-700/20 text-gray-600 dark:text-gray-400';
});
</script>

<template>
  <StatCardSkeleton v-if="loading" />

  <div
    v-else
    class="bg-surface-raised p-5 rounded-2xl border-x border-b border-t-4 border-border flex items-center space-x-4 select-none hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    :class="accentBorderClass"
    :aria-label="`${label}: ${value}`"
  >
    <!-- Left Icon Slot with Beautiful Gradient -->
    <div v-if="$slots.icon" class="p-3 rounded-xl flex-shrink-0" :class="iconContainerClass">
      <slot name="icon" />
    </div>

    <!-- Right KPI values -->
    <div class="min-w-0">
      <span class="block text-[10px] font-bold text-text-muted uppercase tracking-wider truncate">
        {{ label }}
      </span>
      <span class="block text-3xl font-black text-text-base mt-0.5 tracking-tight leading-none">
        {{ value }}
      </span>
      <span v-if="subLabel" class="block text-[10px] text-text-muted mt-1 font-medium truncate">
        {{ subLabel }}
      </span>
    </div>
  </div>
</template>
