<script setup lang="ts">
import type { DashboardDueDates } from '../types';
import StatCard from './StatCard.vue';
import {
  CalendarDaysIcon,
  ExclamationCircleIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline';

defineProps<{
  data: DashboardDueDates | null;
  loading?: boolean;
}>();
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full select-none">
    <!-- Overdue -->
    <StatCard
      label="Overdue Tasks"
      :value="data?.overdue ?? 0"
      color="bg-red-50 text-red-600"
      :loading="loading"
    >
      <template #icon>
        <ExclamationCircleIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>

    <!-- Due Today -->
    <StatCard
      label="Due Today"
      :value="data?.dueToday ?? 0"
      color="bg-amber-50 text-amber-600"
      :loading="loading"
    >
      <template #icon>
        <ClockIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>

    <!-- Due This Week -->
    <StatCard
      label="Due This Week"
      :value="data?.dueThisWeek ?? 0"
      color="bg-blue-50 text-blue-600"
      :loading="loading"
    >
      <template #icon>
        <CalendarDaysIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>

    <!-- Due Next Week -->
    <StatCard
      label="Due Next Week"
      :value="data?.dueNextWeek ?? 0"
      color="bg-purple-50 text-purple-600"
      :loading="loading"
    >
      <template #icon>
        <CalendarDaysIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>
  </div>
</template>
