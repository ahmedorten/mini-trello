// ─── Dashboard API Response (mirrors backend DashboardResponse) ───────────────

export interface RecentActivity {
  id: string;
  action: string;
  createdAt: string;
  cardId: string;
}

export interface TopLabel {
  id: string;
  name: string;
  color: string;
  usage: number;
}

export interface DashboardOverview {
  totalBoards: number;
  totalColumns: number;
  totalCards: number;
  activeCards: number;
  archivedCards: number;
}

export interface DashboardDueDates {
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  dueNextWeek: number;
}

export interface DashboardPriorities {
  low: number;
  medium: number;
  high: number;
}

export interface DashboardChecklists {
  totalChecklists: number;
  totalItems: number;
  completedItems: number;
  remainingItems: number;
  completionPercentage: number;
}

export interface DashboardComments {
  total: number;
}

export interface DashboardAttachments {
  total: number;
  totalSize: number;
}

export interface DashboardLabels {
  total: number;
  topLabels: TopLabel[];
}

export interface DashboardActivity {
  today: number;
  thisWeek: number;
  thisMonth: number;
  recent: RecentActivity[];
}

export interface DashboardResponse {
  overview: DashboardOverview;
  dueDates: DashboardDueDates;
  priorities: DashboardPriorities;
  checklists: DashboardChecklists;
  comments: DashboardComments;
  attachments: DashboardAttachments;
  labels: DashboardLabels;
  activity: DashboardActivity;
}

// ─── Widget Registry Types ────────────────────────────────────────────────────

export type WidgetId =
  | 'overview'
  | 'due-dates'
  | 'priority-breakdown'
  | 'checklist-progress'
  | 'activity-summary'
  | 'top-labels'
  | 'recent-boards';

export type WidgetVisibility = 'always' | 'when-data' | 'configurable';

export interface WidgetDefinition {
  id: WidgetId;
  component: ReturnType<typeof import('vue').defineAsyncComponent>;
  order: number;
  visible: boolean;
  colSpan?: 1 | 2 | 3;
  props?: Record<string, unknown>;
  visibility?: WidgetVisibility;
}
