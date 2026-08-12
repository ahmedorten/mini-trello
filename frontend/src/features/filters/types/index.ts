import type { CardPriority } from '@/features/cards/types/models/CardState';

// ─── Filter Model ─────────────────────────────────────────────────────────────

export interface FilterModel {
  boardId?: string;
  labelId?: string;
  priority?: CardPriority;
  dueBefore?: string;
  dueAfter?: string;
  isArchived?: boolean;
  hasChecklist?: boolean;
  hasComments?: boolean;
  hasAttachments?: boolean;
  /** Future-ready: not sent to API until backend support */
  assigneeId?: string;
}

// ─── Active Filter (for UI display) ──────────────────────────────────────────

export type FilterField = keyof Omit<FilterModel, 'assigneeId'>;

export interface ActiveFilter {
  key: FilterField;
  label: string;
  displayValue: string;
}

// ─── Filter Store State ───────────────────────────────────────────────────────

export interface FilterState {
  activeFilters: FilterModel;
  appliedFilters: FilterModel;
  isDirty: boolean;
}

// ─── Filter Sub-types for UI Components ───────────────────────────────────────

export interface DateRangeFilter {
  dueBefore?: string;
  dueAfter?: string;
}

export type PriorityFilter = CardPriority | undefined;

export interface LabelFilter {
  labelId?: string;
}

export type CompletionFilter = boolean | undefined;
