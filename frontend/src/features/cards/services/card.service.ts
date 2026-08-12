import { CardApi } from '../api/card.api';
import { useCardStore } from '../stores/card.store';
import { CardMapper } from '../mappers/CardMapper';
import { QueryState } from '@/core/api/contracts/QueryState';
import type { CreateCardRequest } from '../types/dto/CreateCardRequest';
import type { UpdateCardRequest } from '../types/dto/UpdateCardRequest';
import type { Card } from '../types/models/Card';

export class CardService {
  public static async fetchCards(columnId: string): Promise<void> {
    const store = useCardStore();
    store.setQueryState(QueryState.Loading);
    store.setError(null);

    const result = await CardApi.listCards(columnId);
    if (result.success) {
      store.setCardsForColumn(columnId, CardMapper.toDomainList(result.data));
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async fetchCardDetails(id: string): Promise<void> {
    const store = useCardStore();
    store.setQueryState(QueryState.Loading);

    const result = await CardApi.getCard(id);
    if (result.success) {
      const card = CardMapper.toDomain(result.data);
      store.setCurrentCard(card);
      store.setDrawerState({ selectedCardId: id, isOpen: true });
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async createCard(columnId: string, data: CreateCardRequest): Promise<Card> {
    const store = useCardStore();
    const result = await CardApi.createCard(columnId, data);

    if (result.success) {
      const card = CardMapper.toDomain(result.data);
      const columnCards = store.cardsByColumn[columnId] || [];
      store.setCardsForColumn(columnId, [...columnCards, card]);
      return card;
    } else {
      throw result.error;
    }
  }

  public static async updateCard(id: string, data: UpdateCardRequest): Promise<void> {
    const store = useCardStore();
    const card = store.currentCard;
    if (!card) return;

    const originalState = JSON.parse(JSON.stringify(store.cardsByColumn));
    const originalCard = { ...card };

    // Apply Optimistic Update
    const updatedCard = { ...card, ...data };
    store.setCurrentCard(updatedCard);
    
    const colList = store.cardsByColumn[card.columnId] || [];
    store.setCardsForColumn(
      card.columnId,
      colList.map(c => c.id === id ? updatedCard : c)
    );

    const result = await CardApi.updateCard(id, data);
    if (!result.success) {
      // Rollback on failure
      store.setCardsForColumn(card.columnId, originalState[card.columnId] || []);
      store.setCurrentCard(originalCard);
      throw result.error;
    }
  }

  public static async deleteCard(id: string, columnId: string): Promise<void> {
    const store = useCardStore();
    const originalList = [...(store.cardsByColumn[columnId] || [])];

    // Optimistic UI update
    store.setCardsForColumn(columnId, originalList.filter(c => c.id !== id));
    if (store.currentCard?.id === id) {
      store.setCurrentCard(null);
      store.setDrawerState({ selectedCardId: null, isOpen: false });
    }

    const result = await CardApi.deleteCard(id);
    if (!result.success) {
      // Rollback on failure
      store.setCardsForColumn(columnId, originalList);
      throw result.error;
    }
  }

  public static async attachLabel(cardId: string, labelId: string): Promise<void> {
    const store = useCardStore();
    const card = store.currentCard;
    if (!card || card.id !== cardId) return;

    // Call API
    const result = await CardApi.attachLabel(cardId, labelId);
    if (result.success) {
      // Refresh details to fetch new label state
      await this.fetchCardDetails(cardId);
      // Also refresh column list to display the label badge
      await this.fetchCards(card.columnId);
    } else {
      throw result.error;
    }
  }

  public static async detachLabel(cardId: string, labelId: string): Promise<void> {
    const store = useCardStore();
    const card = store.currentCard;
    if (!card || card.id !== cardId) return;

    // Call API
    const result = await CardApi.detachLabel(cardId, labelId);
    if (result.success) {
      // Refresh details to fetch new label state
      await this.fetchCardDetails(cardId);
      // Also refresh column list to remove the label badge
      await this.fetchCards(card.columnId);
    } else {
      throw result.error;
    }
  }
}

export default CardService;
