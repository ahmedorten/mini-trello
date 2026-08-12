import { computed } from 'vue';
import { useSearchStore } from '../stores/search.store';

export function useSearchHistory() {
  const searchStore = useSearchStore();

  const history = computed(() => searchStore.history);

  const addEntry = (q: string) => {
    searchStore.addToHistory(q);
  };

  const clearHistory = () => {
    searchStore.clearHistory();
  };

  return {
    history,
    addEntry,
    clearHistory,
  };
}

export default useSearchHistory;
