import { computed } from 'vue';
import { useCardStore } from '../stores/card.store';
import { CardService } from '../services/card.service';


export function useCards() {
  const store = useCardStore();

  const cardsByColumn = computed(() => store.cardsByColumn);
  const currentCard = computed(() => store.currentCard);
  const drawerState = computed(() => store.drawerState);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);

  const loadCardsForColumn = async (columnId: string) => {
    await CardService.fetchCards(columnId);
  };

  const loadCardDetails = async (id: string) => {
    await CardService.fetchCardDetails(id);
  };

  const deleteCard = async (cardId: string, columnId: string) => {
    await CardService.deleteCard(cardId, columnId);
  };

  const resetDrawer = () => {
    store.setDrawerState({ selectedCardId: null, isOpen: false, mode: 'view' });
    store.setCurrentCard(null);
  };

  return {
    cardsByColumn,
    currentCard,
    drawerState,
    queryState,
    error,
    loadCardsForColumn,
    loadCardDetails,
    deleteCard,
    resetDrawer,
  };
}

export default useCards;
