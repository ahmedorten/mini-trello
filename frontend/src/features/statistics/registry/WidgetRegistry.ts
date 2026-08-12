import { defineAsyncComponent } from 'vue';
import type { WidgetDefinition } from '../types';

export const WidgetRegistry: WidgetDefinition[] = [
  {
    id: 'overview',
    component: defineAsyncComponent(
      () => import('../components/OverviewSection.vue')
    ),
    order: 10,
    visible: true,
    colSpan: 3, // full row width (responsive cols grid count is 3)
  },
  {
    id: 'due-dates',
    component: defineAsyncComponent(
      () => import('../components/DueDateWidget.vue')
    ),
    order: 20,
    visible: true,
    colSpan: 3,
  },
  {
    id: 'priority-breakdown',
    component: defineAsyncComponent(
      () => import('../components/PriorityBreakdown.vue')
    ),
    order: 30,
    visible: true,
    colSpan: 1, // 1/3 row width on desktop
  },
  {
    id: 'checklist-progress',
    component: defineAsyncComponent(
      () => import('../components/ChecklistProgress.vue')
    ),
    order: 40,
    visible: true,
    colSpan: 2, // 2/3 row width on desktop
  },
  {
    id: 'activity-summary',
    component: defineAsyncComponent(
      () => import('../components/ActivitySummary.vue')
    ),
    order: 50,
    visible: true,
    colSpan: 2,
  },
  {
    id: 'top-labels',
    component: defineAsyncComponent(
      () => import('../components/TopLabelsWidget.vue')
    ),
    order: 60,
    visible: true,
    colSpan: 1,
  },
  {
    id: 'recent-boards',
    component: defineAsyncComponent(
      () => import('../components/RecentBoardsWidget.vue')
    ),
    order: 70,
    visible: true,
    colSpan: 3,
  },
];

export default WidgetRegistry;
