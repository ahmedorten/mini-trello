import { ref } from 'vue';
import { DragDropService } from '../services/DragDropService';
import { ToastService } from '@/shared/services/ToastService';
import { useCardStore } from '../stores/card.store';

/**
 * Composable to manage the card drag and drop interactions on the frontend,
 * integrating with DragDropService for state syncing and validations.
 */
export const useCardDragDrop = () => {
  const isDragging = ref(false);
  const store = useCardStore();

  const onDragStart = (evt: any) => {
    isDragging.value = true;

    // Capture the original state snapshot BEFORE Sortable.js mutates the store arrays
    DragDropService.snapshot.value = JSON.parse(JSON.stringify(store.cardsByColumn));

    const cardId = evt.item?.dataset?.cardId;
    const fromColumnId = evt.from?.dataset?.columnId;
    const fromIndex = evt.oldIndex;

    DragDropService.sourceColumnId.value = fromColumnId || null;
    DragDropService.sourceIndex.value = fromIndex !== undefined ? fromIndex : null;

    if (cardId && fromColumnId) {
      const sourceList = store.cardsByColumn[fromColumnId] || [];
      DragDropService.draggedCard.value = sourceList.find(c => c.id === cardId) || null;
    }
  };

  /**
   * SortableJS move callback.
   * Restricts dropping based on DragDropService.canDrop hook.
   * Also updates the dragOverColumnId reactive state for browser fallback highlighting.
   */
  const onDragMove = (evt: any) => {
    const targetColumnId = evt.to?.dataset?.columnId;
    const card = DragDropService.draggedCard.value;

    if (card && targetColumnId) {
      if (!DragDropService.canDrop(card, targetColumnId)) {
        return false;
      }
      DragDropService.dragOverColumnId.value = targetColumnId;
    }
    return true;
  };

  const onDragEnd = async (evt: any) => {
    isDragging.value = false;
    
    // Clear drag-over column state immediately
    DragDropService.dragOverColumnId.value = null;

    const cardId = evt.item?.dataset?.cardId;
    const fromColumnId = evt.from?.dataset?.columnId;
    const toColumnId = evt.to?.dataset?.columnId;
    const fromIndex = evt.oldIndex;
    const toIndex = evt.newIndex;

    DragDropService.targetColumnId.value = toColumnId || null;
    DragDropService.targetIndex.value = toIndex !== undefined ? toIndex : null;

    if (!cardId || !fromColumnId || !toColumnId || fromIndex === undefined || toIndex === undefined) {
      resetTransientState();
      return;
    }

    // Skip API request if item position did not change
    if (fromColumnId === toColumnId && fromIndex === toIndex) {
      resetTransientState();
      return;
    }

    try {
      await DragDropService.moveCard(cardId, fromColumnId, toColumnId, fromIndex, toIndex);
      ToastService.success('Card moved successfully.');
    } catch (error: any) {
      // Optimistic UI Rollback: Revert cardsByColumn to snapshot state
      if (DragDropService.snapshot.value) {
        store.cardsByColumn = DragDropService.snapshot.value;
      }
      ToastService.error(error?.message || 'Failed to move card.');
    } finally {
      resetTransientState();
    }
  };

  const resetTransientState = () => {
    DragDropService.draggedCard.value = null;
    DragDropService.sourceColumnId.value = null;
    DragDropService.targetColumnId.value = null;
    DragDropService.sourceIndex.value = null;
    DragDropService.targetIndex.value = null;
    DragDropService.dragOverColumnId.value = null;
    DragDropService.snapshot.value = null;
  };

  return {
    isDragging,
    onDragStart,
    onDragMove,
    onDragEnd,
  };
};

export default useCardDragDrop;
