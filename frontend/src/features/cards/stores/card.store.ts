import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Card } from '../types/models/Card';
import type { DrawerState, CardFilters } from '../types/models/CardState';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useCardStore = defineStore('card', () => {
  const cardsByColumn = ref<Record<string, Card[]>>({});
  const currentCard = ref<Card | null>(null);

  const drawerState = ref<DrawerState>({
    selectedCardId: null,
    isOpen: false,
    mode: 'view',
  });

  const filters = ref<CardFilters>({
    search: '',
    archived: false,
  });

  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);

  const setCardsForColumn = (columnId: string, list: Card[]) => {
    cardsByColumn.value[columnId] = list;
  };

  const setCurrentCard = (card: Card | null) => {
    currentCard.value = card;
  };

  const setDrawerState = (state: Partial<DrawerState>) => {
    drawerState.value = { ...drawerState.value, ...state };
  };

  const updateFilters = (newFilters: Partial<CardFilters>) => {
    filters.value = { ...filters.value, ...newFilters };
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const reset = () => {
    cardsByColumn.value = {};
    currentCard.value = null;
    drawerState.value = { selectedCardId: null, isOpen: false, mode: 'view' };
    filters.value = { search: '', archived: false };
    queryState.value = QueryState.Idle;
    error.value = null;
  };

  return {
    cardsByColumn,
    currentCard,
    drawerState,
    filters,
    queryState,
    error,
    setCardsForColumn,
    setCurrentCard,
    setDrawerState,
    updateFilters,
    setQueryState,
    setError,
    reset,
  };
});

