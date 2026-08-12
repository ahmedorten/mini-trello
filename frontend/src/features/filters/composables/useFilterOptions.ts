import { computed } from 'vue';
import { useBoardStore } from '@/features/boards/stores/board.store';
import { useLabelStore } from '@/features/labels/stores/label.store';
import type { CardPriority } from '@/features/cards/types/models/CardState';

export function useFilterOptions() {
  const boardStore = useBoardStore();
  const labelStore = useLabelStore();

  const boardOptions = computed(() => {
    return boardStore.boards.map((b) => ({
      value: b.id,
      label: b.name,
    }));
  });

  // Collect labels across all boards or the active board
  const labelOptions = computed(() => {
    return labelStore.boardLabels.map((l) => ({
      value: l.id,
      label: l.name,
      color: l.color,
    }));
  });

  const priorityOptions = computed(() => {
    const priorities: CardPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    return priorities.map((p) => ({
      value: p,
      label: p.charAt(0) + p.slice(1).toLowerCase() + ' Priority',
    }));
  });

  const completionOptions = computed(() => [
    { value: 'all', label: 'All Tasks' },
    { value: 'active', label: 'Active Tasks Only' },
    { value: 'archived', label: 'Archived Tasks Only' },
  ]);

  return {
    boardOptions,
    labelOptions,
    priorityOptions,
    completionOptions,
  };
}

export default useFilterOptions;
