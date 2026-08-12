<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  completed: number;
  total: number;
}>();

const percentage = computed(() => {
  if (props.total === 0) return 0;
  return Math.round((props.completed / props.total) * 100);
});

const isFinished = computed(() => {
  return props.total > 0 && props.completed === props.total;
});
</script>

<template>
  <div class="flex items-center space-x-2.5 select-none">
    <!-- Percentage Indicator -->
    <span class="text-xs font-bold text-gray-500 min-w-[28px] text-right">
      {{ percentage }}%
    </span>

    <!-- Progress Track -->
    <div class="flex-1 h-2 bg-gray-150 rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-300 ease-out"
        :class="isFinished ? 'bg-emerald-500' : 'bg-brand-500'"
        :style="{ width: `${percentage}%` }"
        role="progressbar"
        :aria-valuenow="percentage"
        aria-valuemin="0"
        aria-valuemax="100"
      ></div>
    </div>
  </div>
</template>
