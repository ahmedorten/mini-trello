<script setup lang="ts">
import { computed } from 'vue';
import type { DashboardChecklists } from '../types';
import { StatisticsPresenter } from '../presenters/StatisticsPresenter';

const props = defineProps<{
  data: DashboardChecklists | null;
  loading?: boolean;
}>();

const formattedPercent = computed(() => {
  return StatisticsPresenter.formatPercentage(props.data?.completionPercentage);
});
</script>

<template>
  <div v-if="loading" class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs space-y-4">
    <div class="h-4 w-32 bg-gray-200 rounded animate-pulse" />
    <div class="space-y-3">
      <div class="h-6 w-1/4 bg-gray-100 rounded animate-pulse" />
      <div class="h-2 w-full bg-gray-100 rounded animate-pulse" />
    </div>
  </div>

  <div
    v-else
    class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between h-full select-none"
  >
    <div>
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        Checklist Completion
      </h3>

      <div class="space-y-4">
        <div class="flex items-baseline space-x-2">
          <span class="text-3xl font-black text-gray-900 tracking-tight">
            {{ formattedPercent }}
          </span>
          <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Completed Items
          </span>
        </div>

        <div class="w-full bg-gray-150 h-3 rounded-full overflow-hidden">
          <div
            class="bg-brand-600 h-full rounded-full transition-all duration-500"
            :style="{ width: formattedPercent }"
            role="progressbar"
            :aria-valuenow="data?.completionPercentage ?? 0"
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
      </div>
    </div>

    <!-- Details Summary Row -->
    <div class="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
      <span>Completed: {{ data?.completedItems ?? 0 }}</span>
      <span>Remaining: {{ data?.remainingItems ?? 0 }}</span>
      <span>Total: {{ data?.totalItems ?? 0 }}</span>
    </div>
  </div>
</template>
