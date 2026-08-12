import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useCardStore } from '../stores/card.store';
import { CardRefreshService } from '../services/CardRefreshService';

export function useCardContext() {
  const store = useCardStore();
  const route = useRoute();

  const currentCard = computed(() => store.currentCard);
  const drawerState = computed(() => store.drawerState);
  const selectedCardId = computed(() => store.drawerState.selectedCardId);
  const boardId = computed(() => (route.params.id as string) || null);

  const refreshCard = async () => {
    if (selectedCardId.value) {
      await CardRefreshService.refreshCard(selectedCardId.value);
    }
  };

  const refreshCardCounters = async () => {
    if (selectedCardId.value) {
      await CardRefreshService.refreshCounters(selectedCardId.value);
    }
  };

  return {
    currentCard,
    drawerState,
    selectedCardId,
    boardId,
    refreshCard,
    refreshCardCounters,
  };
}

export default useCardContext;
