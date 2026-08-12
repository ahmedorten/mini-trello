import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import { useSearchStore } from '../stores/search.store';
import { SearchService } from '../services/search.service';

export function useSearch() {
  const route = useRoute();
  const router = useRouter();
  const searchStore = useSearchStore();
  const searchService = SearchService.getInstance();

  const searchQuery = ref<string>((route.query.q as string) || '');
  const debouncedQuery = ref<string>(searchQuery.value);

  // Sync searchQuery with store state
  const results = computed(() => searchStore.results);
  const queryState = computed(() => searchStore.queryState);
  const error = computed(() => searchStore.error);

  // Debounce the query update to minimize API hits
  const updateDebouncedQuery = useDebounceFn((val: string) => {
    debouncedQuery.value = val;
  }, 350);

  // Watch for changes in search input and trigger debounced ref
  watch(searchQuery, (newVal) => {
    updateDebouncedQuery(newVal);
  });

  // Watch for debounced query changes and trigger search service or clear
  watch(debouncedQuery, (newVal) => {
    const term = newVal.trim();
    
    // Sync to URL query parameters
    const queryParams = { ...route.query, q: term || undefined };
    router.replace({ query: queryParams });

    if (term === '') {
      searchService.clear();
    } else {
      searchService.search(term);
    }
  });

  // Watch route query to support browser back/forward history navigation
  watch(
    () => route.query.q,
    (newVal) => {
      const term = (newVal as string) || '';
      if (searchQuery.value !== term) {
        searchQuery.value = term;
        debouncedQuery.value = term;
      }
    }
  );

  const clearSearch = () => {
    searchQuery.value = '';
    debouncedQuery.value = '';
    searchService.clear();
  };

  return {
    searchQuery,
    debouncedQuery,
    results,
    queryState,
    error,
    clearSearch,
  };
}

export default useSearch;
