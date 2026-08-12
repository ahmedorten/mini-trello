import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SearchResultSet } from '../types';
import type { QueryState } from '@/core/api/contracts/QueryState';

const HISTORY_KEY = 'mini-trello:search-history';

export const useSearchStore = defineStore('search', () => {
  const query = ref<string>('');
  const results = ref<SearchResultSet | null>(null);
  const queryState = ref<QueryState>('Idle');
  const error = ref<string | null>(null);
  
  // Initialize history from localStorage (max 5 items)
  const history = ref<string[]>([]);
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      history.value = JSON.parse(saved).slice(0, 5);
    }
  } catch {
    history.value = [];
  }

  const setQuery = (q: string) => {
    query.value = q;
  };

  const setResults = (res: SearchResultSet | null) => {
    results.value = res;
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const addToHistory = (q: string) => {
    const term = q.trim();
    if (term === '') return;

    // Filter out duplicates and prepend new query
    const newHistory = [
      term,
      ...history.value.filter((h) => h.toLowerCase() !== term.toLowerCase()),
    ].slice(0, 5);

    history.value = newHistory;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    history.value = [];
    localStorage.removeItem(HISTORY_KEY);
  };

  const reset = () => {
    query.value = '';
    results.value = null;
    queryState.value = 'Idle';
    error.value = null;
  };

  return {
    query,
    results,
    queryState,
    error,
    history,
    setQuery,
    setResults,
    setQueryState,
    setError,
    addToHistory,
    clearHistory,
    reset,
  };
});

export default useSearchStore;
