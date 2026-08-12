import { ref } from 'vue';
import { CardApi } from '../api/card.api';
import { useCardStore } from '../stores/card.store';
import { CardMapper } from '../mappers/CardMapper';
import { moveItem, reorderArray } from '@/shared/utils/ordering';
import type { Card } from '../types/models/Card';

/**
 * Service to orchestrate card drag-and-drop operations,
 * optimistic UI updates, rollbacks, and concurrent operation protection.
 *
 * NOTE: Virtualization renders require index-based updates; this service
 * operates purely on source/destination indices and column keys.
 */
export class DragDropService {
  // Transient Drag State (Stored outside Vue components to maintain architectural boundaries)
  public static draggedCard = ref<Card | null>(null);
  public static sourceColumnId = ref<string | null>(null);
  public static targetColumnId = ref<string | null>(null);
  public static sourceIndex = ref<number | null>(null);
  public static targetIndex = ref<number | null>(null);
  public static dragOverColumnId = ref<string | null>(null);
  
  // Snapshots for rollbacks
  public static snapshot = ref<Record<string, Card[]> | null>(null);

  // Synchronization and Race Condition Protection
  public static isSyncing = ref<boolean>(false);
  private static latestOperationId = 0;

  /**
   * Drop Validation Extension Hook.
   * Can be extended in the future for workspace permissions or stage workflow validation.
   */
  public static canDrop(_card: Card, _targetColumnId: string): boolean {
    // Default implementation allows all drops
    return true;
  }

  /**
   * Post-move Undo Extension Hook.
   */
  public static onPostMove(
    _cardId: string,
    _fromColumnId: string,
    _toColumnId: string,
    _fromIndex: number,
    _toIndex: number
  ): void {
    // Extension point for future undo operations
  }

  /**
   * Analytics and Activity Tracking Extension Hook.
   */
  public static trackMove(_cardId: string, _fromColumnId: string, _toColumnId: string): void {
    // Extension point for telemetry and audit logs
  }

  /**
   * Orchestrates the card movement between columns and indices, preserving optimistic updates.
   */
  public static async moveCard(
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    fromIndex: number,
    toIndex: number
  ): Promise<void> {
    const store = useCardStore();
    
    // Increment operation ID to prevent stale API race conditions
    DragDropService.latestOperationId++;
    const currentOpId = DragDropService.latestOperationId;

    // Detect if VueDraggable already mutated the store array (drag-and-drop flow)
    const currentDestList = store.cardsByColumn[toColumnId] || [];
    const isAlreadyAtTarget = currentDestList[toIndex]?.id === cardId;

    // 1. Perform optimistic state updates in store if NOT already mutated (e.g. details drawer select-box move)
    if (!isAlreadyAtTarget) {
      if (fromColumnId === toColumnId) {
        const sourceList = store.cardsByColumn[fromColumnId] || [];
        const updatedList = reorderArray(sourceList, fromIndex, toIndex);
        store.setCardsForColumn(fromColumnId, updatedList);
      } else {
        const sourceList = store.cardsByColumn[fromColumnId] || [];
        const destList = store.cardsByColumn[toColumnId] || [];
        const { nextSource, nextDest, item } = moveItem(sourceList, destList, fromIndex, toIndex);
        item.columnId = toColumnId;
        store.setCardsForColumn(fromColumnId, nextSource);
        store.setCardsForColumn(toColumnId, nextDest);
      }
    } else {
      // If already at target, make sure the card object's internal columnId property is updated correctly
      const targetCard = currentDestList[toIndex];
      if (targetCard) {
        targetCard.columnId = toColumnId;
      }
    }

    // Trigger non-blocking syncing state
    DragDropService.isSyncing.value = true;

    try {
      // 2. Persist to API
      const result = await CardApi.moveCard(cardId, {
        destinationColumnId: toColumnId,
        destinationPosition: toIndex,
      });

      // Ignore if a newer drag operation was initiated in the meantime
      if (currentOpId !== DragDropService.latestOperationId) {
        return;
      }

      if (result.success) {
        // Apply mapper and update with fresh data (e.g. updated positions or version IDs)
        const updatedCard = CardMapper.fromMoveResponse(result.data);
        const currentList = store.cardsByColumn[toColumnId] || [];
        store.setCardsForColumn(
          toColumnId,
          currentList.map(c => c.id === cardId ? updatedCard : c)
        );

        // Keep store's currentCard in sync if it is the one that was moved
        if (store.currentCard?.id === cardId) {
          store.currentCard.columnId = toColumnId;
        }

        // Trigger extension hooks
        DragDropService.onPostMove(cardId, fromColumnId, toColumnId, fromIndex, toIndex);
        DragDropService.trackMove(cardId, fromColumnId, toColumnId);
      } else {
        throw result.error;
      }
    } finally {
      // Reset non-blocking syncing flag if this is still the latest operation
      if (currentOpId === DragDropService.latestOperationId) {
        DragDropService.isSyncing.value = false;
      }
    }
  }
}

export default DragDropService;
