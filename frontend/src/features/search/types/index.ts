import type { RouteLocationRaw } from 'vue-router';
import type { QueryState } from '@/core/api/contracts/QueryState';
import type { FilterModel } from '@/features/filters/types';
import type { CardPriority } from '@/features/cards/types/models/CardState';

// ─── Entity Types ────────────────────────────────────────────────────────────

export type SearchEntityType = 'board' | 'card' | 'column' | 'label';

// ─── Unified Search Result ViewModel ─────────────────────────────────────────

export interface SearchResultItem {
  id: string;
  entityType: SearchEntityType;
  title: string;
  breadcrumb: string;
  icon: string;
  labels: Array<{ id: string; name: string; color: string }>;
  priority?: CardPriority;
  dueDate?: string | null;
  routeTo: RouteLocationRaw;
  meta: Record<string, unknown>;
}

// ─── Provider Contract ────────────────────────────────────────────────────────

export interface SearchProviderResult {
  entityType: SearchEntityType;
  items: SearchResultItem[];
  totalCount: number;
}

export interface ISearchProvider {
  readonly entityType: SearchEntityType;
  search(
    query: string,
    filters?: FilterModel,
    signal?: AbortSignal
  ): Promise<SearchProviderResult>;
}

// ─── Grouped Result Set ───────────────────────────────────────────────────────

export interface SearchResultSet {
  groups: SearchProviderResult[];
  totalCount: number;
  query: string;
}

// ─── Store State ──────────────────────────────────────────────────────────────

export interface SearchState {
  query: string;
  results: SearchResultSet | null;
  queryState: QueryState;
  error: string | null;
  history: string[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface SearchCacheEntry {
  results: SearchResultSet;
  timestamp: number;
  lastAccessedAt: number;
  hitCount: number;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export interface SearchQuery {
  q: string;
  filters?: FilterModel;
}
