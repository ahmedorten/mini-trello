import type { Column } from './Column';
import type { QueryState } from '@/core/api/contracts/QueryState';

export interface ColumnState {
  columns: Column[];
  queryState: QueryState;
  error: string | null;
}
