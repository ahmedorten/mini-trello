import { computed, ref, watch } from 'vue';
import { useBoardStore } from '../stores/board.store';
import { BoardService } from '../services/board.service';
import { useDebounceFn } from '@vueuse/core';

export function useBoards() {
  const store = useBoardStore();

  const boards = computed(() => store.boards);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);
  const filters = computed(() => store.filters);
  const total = computed(() => store.total);
  const totalPages = computed(() => store.totalPages);

  const searchInput = ref(store.filters.q);

  const debouncedSearch = useDebounceFn((value: string) => {
    store.updateFilters({ q: value, page: 1 });
    BoardService.fetchBoards();
  }, 350);

  watch(searchInput, (newValue) => {
    debouncedSearch(newValue);
  });

  const changePage = (page: number) => {
    store.updateFilters({ page });
    BoardService.fetchBoards();
  };

  const loadBoards = async () => {
    await BoardService.fetchBoards();
  };

  return {
    boards,
    queryState,
    error,
    filters,
    total,
    totalPages,
    searchInput,
    changePage,
    loadBoards,
  };
}

export default useBoards;
