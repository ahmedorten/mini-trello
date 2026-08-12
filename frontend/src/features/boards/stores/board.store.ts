import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Board } from '../types/models/Board';
import type { BoardFilters } from '../types/models/BoardState';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useBoardStore = defineStore('board', () => {
  const boards = ref<Board[]>([]);
  const currentBoard = ref<Board | null>(null);
  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);
  
  const filters = ref<BoardFilters>({
    q: '',
    page: 1,
    pageSize: 10,
  });

  const total = ref(0);
  const totalPages = ref(0);

  const setBoards = (list: Board[]) => {
    boards.value = list;
  };

  const setCurrentBoard = (board: Board | null) => {
    currentBoard.value = board;
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const updateFilters = (newFilters: Partial<BoardFilters>) => {
    filters.value = { ...filters.value, ...newFilters };
  };

  const setPagination = (pagination: { total: number; totalPages: number }) => {
    total.value = pagination.total;
    totalPages.value = pagination.totalPages;
  };

  const reset = () => {
    boards.value = [];
    currentBoard.value = null;
    queryState.value = QueryState.Idle;
    error.value = null;
    filters.value = { q: '', page: 1, pageSize: 10 };
    total.value = 0;
    totalPages.value = 0;
  };

  return {
    boards,
    currentBoard,
    queryState,
    error,
    filters,
    total,
    totalPages,
    setBoards,
    setCurrentBoard,
    setQueryState,
    setError,
    updateFilters,
    setPagination,
    reset,
  };
});
