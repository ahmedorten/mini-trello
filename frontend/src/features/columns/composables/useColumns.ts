import { computed } from 'vue';
import { useColumnStore } from '../stores/column.store';
import { ColumnService } from '../services/column.service';
import type { Column } from '../types/models/Column';

export function useColumns() {
  const store = useColumnStore();

  const columns = computed(() => store.columns);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);

  const loadColumns = async (boardId: string) => {
    await ColumnService.fetchColumns(boardId);
  };

  const reorderColumnsLocally = async (newOrderList: Column[]) => {
    try {
      await ColumnService.updateColumnPositions(newOrderList);
    } catch (e: any) {
      const { ToastService } = await import('@/shared/services/ToastService');
      ToastService.error(e?.message || 'Failed to update column order. Reverted.');
    }
  };

  return {
    columns,
    queryState,
    error,
    loadColumns,
    reorderColumnsLocally,
  };
}

export default useColumns;
