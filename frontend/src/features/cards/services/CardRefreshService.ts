import { CardApi } from '../api/card.api';
import { useCardStore } from '../stores/card.store';
import { CardMapper } from '../mappers/CardMapper';

export class CardRefreshService {
  public static async refreshCard(id: string): Promise<void> {
    const store = useCardStore();
    const result = await CardApi.getCard(id);
    if (result.success) {
      store.setCurrentCard(CardMapper.toDomain(result.data));
    }
  }

  public static async refreshCounters(id: string): Promise<void> {
    const store = useCardStore();
    const result = await CardApi.getCard(id);
    if (result.success) {
      const updatedCard = CardMapper.toDomain(result.data);
      // Synchronize metadata changes to board columns lists
      const colCards = store.cardsByColumn[updatedCard.columnId] || [];
      store.setCardsForColumn(
        updatedCard.columnId,
        colCards.map(c => c.id === id ? {
          ...c,
          commentsCount: updatedCard.commentsCount,
          completedItems: updatedCard.completedItems,
          totalItems: updatedCard.totalItems,
          progress: updatedCard.progress,
          attachmentsCount: updatedCard.attachmentsCount,
        } : c)
      );
    }
  }
}

export default CardRefreshService;
