<script setup lang="ts">
import type { DashboardLabels } from '../types';

defineProps<{
  data: DashboardLabels | null;
  loading?: boolean;
}>();
</script>

<template>
  <div v-if="loading" class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs space-y-4">
    <div class="h-4 w-32 bg-gray-200 rounded animate-pulse" />
    <div class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-6 bg-gray-100 rounded animate-pulse" />
    </div>
  </div>

  <div
    v-else
    class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between h-full select-none"
  >
    <div>
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        Top Labels
      </h3>

      <div v-if="!data?.topLabels || data.topLabels.length === 0" class="py-10 text-center text-gray-400 text-xs">
        No labels are currently applied to cards.
      </div>

      <div v-else class="space-y-3.5">
        <div
          v-for="lbl in data.topLabels"
          :key="lbl.id"
          class="flex items-center justify-between text-xs"
        >
          <!-- Label pill -->
          <span
            class="px-2.5 py-1.5 rounded-lg text-white font-bold select-none text-[10px] uppercase tracking-wider truncate max-w-[140px]"
            :style="{ backgroundColor: lbl.color }"
          >
            {{ lbl.name }}
          </span>

          <!-- Usage count -->
          <span class="text-xs text-gray-500 font-bold">
            {{ lbl.usage }} {{ lbl.usage === 1 ? 'card' : 'cards' }}
          </span>
        </div>
      </div>
    </div>

    <div class="mt-4 pt-3.5 border-t border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
      Total Unique Labels: {{ data?.total ?? 0 }}
    </div>
  </div>
</template>
