import { ColumnApi } from '../api/column.api';
import { useColumnStore } from '../stores/column.store';
import { QueryState } from '@/core/api/contracts/QueryState';
import type { CreateColumnRequest } from '../types/dto/CreateColumnRequest';
import type { Column } from '../types/models/Column';

export class ColumnService {
  public static async fetchColumns(boardId: string): Promise<void> {
    const store = useColumnStore();
    const isInitial = store.columns.length === 0;
    store.setQueryState(isInitial ? QueryState.Loading : QueryState.Refreshing);
    store.setError(null);

    const result = await ColumnApi.listColumns(boardId);
    if (result.success) {
      // Columns from backend are pre-sorted by position
      store.setColumns(result.data);
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async createColumn(boardId: string, data: CreateColumnRequest): Promise<Column> {
    const store = useColumnStore();

    // Optimistic UI update
    const tempId = `temp-${crypto.randomUUID()}`;
    const nextPosition = store.columns.length > 0
      ? Math.max(...store.columns.map(c => c.position)) + 1
      : 0;

    const tempColumn: Column = {
      id: tempId,
      boardId,
      name: data.name,
      position: nextPosition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const previousColumns = [...store.columns];
    store.setColumns([...store.columns, tempColumn]);

    const result = await ColumnApi.createColumn(boardId, data);
    if (result.success) {
      // Swap temp column with actual column details
      store.setColumns(store.columns.map(c => c.id === tempId ? result.data : c));
      return result.data;
    } else {
      // Rollback
      store.setColumns(previousColumns);
      throw result.error;
    }
  }

  public static async renameColumn(id: string, name: string): Promise<void> {
    const store = useColumnStore();

    // Optimistic UI update: backup & update locally
    const previousColumns = [...store.columns];
    store.setColumns(store.columns.map(c => c.id === id ? { ...c, name } : c));

    const result = await ColumnApi.updateColumn(id, { name });
    if (!result.success) {
      // Rollback on failure
      store.setColumns(previousColumns);
      throw result.error;
    }
  }

  public static async deleteColumn(id: string): Promise<void> {
    const store = useColumnStore();

    // Optimistic UI update: backup & remove locally
    const previousColumns = [...store.columns];
    store.setColumns(store.columns.filter(c => c.id !== id));

    const result = await ColumnApi.deleteColumn(id);
    if (!result.success) {
      // Rollback on failure
      store.setColumns(previousColumns);
      throw result.error;
    }
  }

  public static async updateColumnPositions(columns: Column[]): Promise<void> {
    const store = useColumnStore();
    const previousColumns = [...store.columns];

    // Spacing by index positions
    const updatedColumns = columns.map((col, index) => ({
      ...col,
      position: index,
    }));
    store.setColumns(updatedColumns);

    try {
      await Promise.all(
        updatedColumns.map((col, index) => {
          const prevCol = previousColumns.find(c => c.id === col.id);
          // Only send update if position actually changed
          if (prevCol && prevCol.position === index) return Promise.resolve();
          return ColumnApi.updateColumn(col.id, { position: index });
        })
      );
    } catch (error) {
      // Rollback on failure
      store.setColumns(previousColumns);
      throw error;
    }
  }
}

export default ColumnService;

