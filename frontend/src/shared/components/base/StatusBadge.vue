<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/shared/composables/useI18n';

const props = withDefaults(defineProps<{
  type?: 'priority' | 'status' | 'default';
  value: string;
}>(), {
  type: 'default',
});

const { t } = useI18n();

const badgeStyle = computed(() => {
  const val = props.value.toUpperCase();
  
  if (props.type === 'priority') {
    switch (val) {
      case 'HIGH':
        return {
          bg: 'bg-red-50 dark:bg-red-950/30',
          text: 'text-red-700 dark:text-red-400',
          border: 'border-red-200/60 dark:border-red-900/40',
          dot: 'bg-red-500',
          label: t('cards.priorityHigh'),
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/30',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-200/60 dark:border-amber-900/40',
          dot: 'bg-amber-500',
          label: t('cards.priorityMedium'),
        };
      case 'LOW':
        return {
          bg: 'bg-sky-50 dark:bg-sky-950/30',
          text: 'text-sky-700 dark:text-sky-400',
          border: 'border-sky-200/60 dark:border-sky-900/40',
          dot: 'bg-sky-500',
          label: t('cards.priorityLow'),
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800/40',
          text: 'text-gray-600 dark:text-gray-400',
          border: 'border-gray-250/50 dark:border-gray-700/50',
          dot: 'bg-gray-400',
          label: t('cards.noPriority'),
        };
    }
  }

  if (props.type === 'status') {
    switch (val) {
      case 'COMPLETED':
      case 'COMPLETE':
      case 'TRUE':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/30',
          text: 'text-emerald-700 dark:text-emerald-450',
          border: 'border-emerald-200/60 dark:border-emerald-900/40',
          dot: 'bg-emerald-500',
          label: t('cards.completed'),
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-850/40',
          text: 'text-gray-600 dark:text-gray-400',
          border: 'border-gray-200 dark:border-gray-800/60',
          dot: 'bg-gray-450',
          label: props.value,
        };
    }
  }

  // Default Badge
  return {
    bg: 'bg-gray-50 dark:bg-gray-800/40',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200/80 dark:border-gray-700/50',
    dot: '',
    label: props.value,
  };
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium tracking-wide shadow-xs transition-colors duration-200 select-none',
      badgeStyle.bg,
      badgeStyle.text,
      badgeStyle.border
    ]"
  >
    <span
      v-if="badgeStyle.dot"
      :class="['h-1.5 w-1.5 rounded-full shrink-0', badgeStyle.dot]"
    />
    <span>{{ badgeStyle.label }}</span>
  </span>
</template>
