<script setup lang="ts">
import { computed } from 'vue';
import type { DashboardPriorities } from '../types';
import { StatisticsPresenter } from '../presenters/StatisticsPresenter';

const props = defineProps<{
  data: DashboardPriorities | null;
  loading?: boolean;
}>();

const total = computed(() => {
  if (!props.data) return 0;
  return (props.data.low || 0) + (props.data.medium || 0) + (props.data.high || 0);
});

const calculatePercent = (val?: number) => {
  if (total.value === 0 || !val) return 0;
  return Math.round((val / total.value) * 100);
};

const formatPct = (val?: number) => {
  return StatisticsPresenter.formatPercentage(calculatePercent(val));
};
</script>

<template>
  <div v-if="loading" class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs space-y-4">
    <div class="h-4 w-32 bg-gray-200 rounded animate-pulse" />
    <div class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-8 bg-gray-100 rounded animate-pulse" />
    </div>
  </div>

  <div
    v-else
    class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between h-full select-none"
  >
    <div>
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        Priority Breakdown
      </h3>

      <div class="space-y-4">
        <!-- High Priority -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span class="flex items-center space-x-1.5 text-red-600">
              <span class="h-2 w-2 rounded-full bg-red-600" />
              <span>High</span>
            </span>
            <span>{{ data?.high ?? 0 }} ({{ formatPct(data?.high) }})</span>
          </div>
          <div class="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div
              class="bg-red-600 h-full rounded-full transition-all duration-500"
              :style="{ width: formatPct(data?.high) }"
              role="progressbar"
              :aria-valuenow="calculatePercent(data?.high)"
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>

        <!-- Medium Priority -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span class="flex items-center space-x-1.5 text-amber-600">
              <span class="h-2 w-2 rounded-full bg-amber-500" />
              <span>Medium</span>
            </span>
            <span>{{ data?.medium ?? 0 }} ({{ formatPct(data?.medium) }})</span>
          </div>
          <div class="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div
              class="bg-amber-500 h-full rounded-full transition-all duration-500"
              :style="{ width: formatPct(data?.medium) }"
              role="progressbar"
              :aria-valuenow="calculatePercent(data?.medium)"
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>

        <!-- Low Priority -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span class="flex items-center space-x-1.5 text-blue-600">
              <span class="h-2 w-2 rounded-full bg-blue-500" />
              <span>Low</span>
            </span>
            <span>{{ data?.low ?? 0 }} ({{ formatPct(data?.low) }})</span>
          </div>
          <div class="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div
              class="bg-blue-500 h-full rounded-full transition-all duration-500"
              :style="{ width: formatPct(data?.low) }"
              role="progressbar"
              :aria-valuenow="calculatePercent(data?.low)"
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4 pt-3.5 border-t border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
      Total Assigned Cards: {{ total }}
    </div>
  </div>
</template>
