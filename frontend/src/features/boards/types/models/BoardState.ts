import type { Board } from './Board';
import type { QueryState } from '@/core/api/contracts/QueryState';

export interface BoardFilters {
  q: string;
  page: number;
  pageSize: number;
}

export interface BoardState {
  boards: Board[];
  currentBoard: Board | null;
  queryState: QueryState;
  error: string | null;
  filters: BoardFilters;
  total: number;
  totalPages: number;
}
