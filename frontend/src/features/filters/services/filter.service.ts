import type { FilterModel, FilterField, ActiveFilter } from '../types';

// Map of filter field keys to human-readable display labels
const FILTER_LABELS: Record<FilterField, string> = {
  boardId: 'Board',
  labelId: 'Label',
  priority: 'Priority',
  dueBefore: 'Due Before',
  dueAfter: 'Due After',
  isArchived: 'Archived',
  hasChecklist: 'Has Checklist',
  hasComments: 'Has Comments',
  hasAttachments: 'Has Attachments',
};

// Priority label mapping
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low Priority',
  MEDIUM: 'Medium Priority',
  HIGH: 'High Priority',
};

export class FilterService {
  /**
   * Translate FilterModel into API-compatible search params.
   * Only defined, non-undefined fields are included.
   */
  public static toSearchParams(filters: FilterModel): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (filters.boardId) params.boardId = filters.boardId;
    if (filters.labelId) params.labelId = filters.labelId;
    if (filters.priority) params.priority = filters.priority;
    if (filters.dueBefore) params.dueBefore = filters.dueBefore;
    if (filters.dueAfter) params.dueAfter = filters.dueAfter;
    if (filters.isArchived !== undefined) params.isArchived = filters.isArchived;
    if (filters.hasChecklist !== undefined) params.hasChecklist = filters.hasChecklist;
    if (filters.hasComments !== undefined) params.hasComments = filters.hasComments;
    if (filters.hasAttachments !== undefined) params.hasAttachments = filters.hasAttachments;

    return params;
  }

  /**
   * Deserialize URL query parameters back into a FilterModel.
   * Unknown or invalid values are silently ignored.
   */
  public static fromRouteQuery(query: Record<string, string | string[]>): FilterModel {
    const model: FilterModel = {};
    const get = (key: string): string | undefined => {
      const v = query[key];
      return Array.isArray(v) ? v[0] : v;
    };

    if (get('board_id')) model.boardId = get('board_id');
    if (get('label_id')) model.labelId = get('label_id');

    const priority = get('priority');
    if (priority === 'LOW' || priority === 'MEDIUM' || priority === 'HIGH') {
      model.priority = priority;
    }

    if (get('due_before')) model.dueBefore = get('due_before');
    if (get('due_after')) model.dueAfter = get('due_after');

    const isArchived = get('is_archived');
    if (isArchived === 'true') model.isArchived = true;
    if (isArchived === 'false') model.isArchived = false;

    const hasChecklist = get('has_checklist');
    if (hasChecklist === 'true') model.hasChecklist = true;
    if (hasChecklist === 'false') model.hasChecklist = false;

    const hasComments = get('has_comments');
    if (hasComments === 'true') model.hasComments = true;
    if (hasComments === 'false') model.hasComments = false;

    const hasAttachments = get('has_attachments');
    if (hasAttachments === 'true') model.hasAttachments = true;
    if (hasAttachments === 'false') model.hasAttachments = false;

    return model;
  }

  /**
   * Serialize FilterModel into URL query string params.
   * Uses lowercase snake_case for readability.
   */
  public static toRouteQuery(filters: FilterModel): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.boardId) query.board_id = filters.boardId;
    if (filters.labelId) query.label_id = filters.labelId;
    if (filters.priority) query.priority = filters.priority;
    if (filters.dueBefore) query.due_before = filters.dueBefore;
    if (filters.dueAfter) query.due_after = filters.dueAfter;
    if (filters.isArchived !== undefined) query.is_archived = String(filters.isArchived);
    if (filters.hasChecklist !== undefined) query.has_checklist = String(filters.hasChecklist);
    if (filters.hasComments !== undefined) query.has_comments = String(filters.hasComments);
    if (filters.hasAttachments !== undefined) query.has_attachments = String(filters.hasAttachments);

    return query;
  }

  /**
   * Check whether a FilterModel has any active filters set.
   */
  public static hasActiveFilters(filters: FilterModel): boolean {
    return Object.values(filters).some((v) => v !== undefined);
  }

  /**
   * Convert a FilterModel into a list of ActiveFilter display items.
   * Used to render FilterChip components.
   */
  public static toActiveFilters(
    filters: FilterModel,
    boardName?: string,
    labelName?: string
  ): ActiveFilter[] {
    const chips: ActiveFilter[] = [];

    if (filters.boardId && boardName) {
      chips.push({ key: 'boardId', label: FILTER_LABELS.boardId, displayValue: boardName });
    }
    if (filters.labelId && labelName) {
      chips.push({ key: 'labelId', label: FILTER_LABELS.labelId, displayValue: labelName });
    }
    if (filters.priority) {
      chips.push({
        key: 'priority',
        label: FILTER_LABELS.priority,
        displayValue: PRIORITY_LABELS[filters.priority] ?? filters.priority,
      });
    }
    if (filters.dueBefore) {
      chips.push({ key: 'dueBefore', label: FILTER_LABELS.dueBefore, displayValue: filters.dueBefore });
    }
    if (filters.dueAfter) {
      chips.push({ key: 'dueAfter', label: FILTER_LABELS.dueAfter, displayValue: filters.dueAfter });
    }
    if (filters.isArchived !== undefined) {
      chips.push({
        key: 'isArchived',
        label: FILTER_LABELS.isArchived,
        displayValue: filters.isArchived ? 'Yes' : 'No',
      });
    }
    if (filters.hasChecklist !== undefined) {
      chips.push({
        key: 'hasChecklist',
        label: FILTER_LABELS.hasChecklist,
        displayValue: filters.hasChecklist ? 'Yes' : 'No',
      });
    }
    if (filters.hasComments !== undefined) {
      chips.push({
        key: 'hasComments',
        label: FILTER_LABELS.hasComments,
        displayValue: filters.hasComments ? 'Yes' : 'No',
      });
    }
    if (filters.hasAttachments !== undefined) {
      chips.push({
        key: 'hasAttachments',
        label: FILTER_LABELS.hasAttachments,
        displayValue: filters.hasAttachments ? 'Yes' : 'No',
      });
    }

    return chips;
  }
}

export default FilterService;
