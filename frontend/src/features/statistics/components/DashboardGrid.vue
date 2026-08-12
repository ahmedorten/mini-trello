<script setup lang="ts">
import type { WidgetDefinition, DashboardResponse } from '../types';

defineProps<{
  widgets: WidgetDefinition[];
  stats: DashboardResponse | null;
  loading?: boolean;
}>();

const getColSpanClass = (span?: number) => {
  switch (span) {
    case 1:
      return 'lg:col-span-1';
    case 2:
      return 'lg:col-span-2';
    case 3:
      return 'lg:col-span-3';
    default:
      return 'lg:col-span-1';
  }
};

const getWidgetData = (id: string, stats: DashboardResponse | null) => {
  if (!stats) return null;
  switch (id) {
    case 'overview':
      return stats.overview;
    case 'due-dates':
      return stats.dueDates;
    case 'priority-breakdown':
      return stats.priorities;
    case 'checklist-progress':
      return stats.checklists;
    case 'activity-summary':
      return stats.activity;
    case 'top-labels':
      return stats.labels;
    default:
      return null;
  }
};
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-stretch select-none">
    <div
      v-for="widget in widgets"
      :key="widget.id"
      :class="getColSpanClass(widget.colSpan)"
      v-memo="[widget.id, loading, stats]"
    >
      <component
        :is="widget.component"
        :data="getWidgetData(widget.id, stats)"
        :loading="loading"
        v-bind="widget.props"
      />
    </div>
  </div>
</template>
